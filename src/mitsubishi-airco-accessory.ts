import {
    AccessoryConfig,
    AccessoryPlugin,
    API,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    Formats,
    HAP,
    Logging,
    Perms,
    Service,
    Units
} from "homebridge";

import {AirCooler, HSwingMode, Mode, VSwingMode, WfracAdapter} from "./lg/wfrac-adapter";
import {MitsubishiAircoController} from "./lg/mitsubishi-airco-controller";
import {AsyncUtils} from "./utils/async-utils";
import {DummyController} from "./lg/dummy-controller";
import {Controller} from "./lg/controller";
import {PythonUtils} from "./utils/python-utils";

export class MitsubishiAirCoolerAccessory implements AccessoryPlugin {

    private readonly hap: HAP;
    private readonly log: Logging;
    private readonly config: AccessoryConfig;
    private readonly storagePath: string;
    private readonly logDebug: Function;

    private readonly informationService: Service;
    private readonly heaterCoolerService: Service;

    private airCooler: AirCooler;
    private controller: Controller;

    private powerStateWillChange: boolean = false;
    private handleRotationSpeedSetWithDebounce: Function;

    constructor(log: Logging, config: AccessoryConfig, api: API) {
        this.hap = api.hap;
        this.log = log;
        this.config = config;
        this.logDebug = this.config.debug ? this.log : () => {};
        PythonUtils.logDebug = this.logDebug;

        this.informationService = new this.hap.Service.AccessoryInformation()
            .setCharacteristic(this.hap.Characteristic.Manufacturer, 'Mitsubishi')
            .setCharacteristic(this.hap.Characteristic.Model, 'AIR CONDITIONER')
            .setCharacteristic(this.hap.Characteristic.SerialNumber, this.config.model);
        this.heaterCoolerService = new this.hap.Service.HeaterCooler(this.config.name);

        setTimeout(async () => {
            this.airCooler = await WfracAdapter.listAirCoolers(this.config.ip);

            this.controller = new MitsubishiAircoController(this.airCooler, this.config.ip, this.config.updateInterval, this.config.debug, this.logDebug);

            this.handleRotationSpeedSetWithDebounce = AsyncUtils.debounce((newFanSpeed: number) => {
                this.controller.setFanSpeed(WfracAdapter.percentageToFanSpeed(newFanSpeed));
            }, 5000);

            this.heaterCoolerService.getCharacteristic(this.hap.Characteristic.Active)
                .on(CharacteristicEventTypes.GET, this.handleActiveGet.bind(this))
                .on(CharacteristicEventTypes.SET, this.handleActiveSet.bind(this));

            this.heaterCoolerService.getCharacteristic(this.hap.Characteristic.CurrentHeaterCoolerState)
                .on(CharacteristicEventTypes.GET, this.handleCurrentHeaterCoolerStateGet.bind(this));

            this.heaterCoolerService.getCharacteristic(this.hap.Characteristic.TargetHeaterCoolerState)
                .setProps({
                    format: Formats.UINT8,
                    maxValue: 2,
                    minValue: 0,
                    validValues: [1, 2],
                    perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
                })
                .on(CharacteristicEventTypes.GET, this.handleTargetHeaterCoolerStateGet.bind(this))
                .on(CharacteristicEventTypes.SET, this.handleTargetHeaterCoolerStateSet.bind(this));

            this.heaterCoolerService.getCharacteristic(this.hap.Characteristic.CurrentTemperature)
                .on(CharacteristicEventTypes.GET, this.handleCurrentTemperatureGet.bind(this));

            this.heaterCoolerService.getCharacteristic(this.hap.Characteristic.CoolingThresholdTemperature)
                .setProps({
                    format: Formats.FLOAT,
                    unit: Units.CELSIUS,
                    maxValue: this.config.maxCoolingTemp,
                    minValue: this.config.minCoolingTemp,
                    minStep: 1,
                    perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
                })
                .on(CharacteristicEventTypes.GET, this.handleCoolingThresholdTemperatureGet.bind(this))
                .on(CharacteristicEventTypes.SET, this.handleCoolingThresholdTemperatureSet.bind(this));

            this.heaterCoolerService.getCharacteristic(this.hap.Characteristic.HeatingThresholdTemperature)
                .setProps({
                    format: Formats.FLOAT,
                    unit: Units.CELSIUS,
                    maxValue: this.config.maxHeatingTemp,
                    minValue: this.config.minHeatingTemp,
                    minStep: 1,
                    perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY]
                })
                .on(CharacteristicEventTypes.GET, this.handleHeatingThresholdTemperatureGet.bind(this))
                .on(CharacteristicEventTypes.SET, this.handleHeatingThresholdTemperatureSet.bind(this));

            this.heaterCoolerService.getCharacteristic(this.hap.Characteristic.RotationSpeed)
                .on(CharacteristicEventTypes.GET, this.handleRotationSpeedGet.bind(this))
                .on(CharacteristicEventTypes.SET, this.handleRotationSpeedSet.bind(this));

            this.heaterCoolerService.getCharacteristic(this.hap.Characteristic.SwingMode)
                .on(CharacteristicEventTypes.GET, this.handleSwingModeGet.bind(this))
                .on(CharacteristicEventTypes.SET, this.handleSwingModeSet.bind(this));
        });
    }

    public getServices(): Service[] {
        return [
            this.informationService,
            this.heaterCoolerService
        ];
    }

    public identify(): void {
        this.log("Identify!");
    }

    private handleActiveGet(callback: CharacteristicGetCallback): void {
        callback(null, this.controller.isPoweredOn() ? this.hap.Characteristic.Active.ACTIVE : this.hap.Characteristic.Active.INACTIVE);
    }

    private handleActiveSet(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
        if (!this.powerStateWillChange && !this.controller.isPoweredOn() === (value === this.hap.Characteristic.Active.ACTIVE)) {
            this.controller.setPowerState(value === this.hap.Characteristic.Active.ACTIVE);
        } else {
            this.powerStateWillChange = false;
        }
        callback(null);
    }

    private handleCurrentHeaterCoolerStateGet(callback: CharacteristicGetCallback): void {
        let currentHeaterCoolerState: any;
        if (!this.controller.isPoweredOn()) {
            currentHeaterCoolerState = this.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
        } else {
            switch (this.controller.getMode()) {
                case Mode.COOL:
                    currentHeaterCoolerState = this.hap.Characteristic.CurrentHeaterCoolerState.COOLING;
                    break;
                case Mode.HEAT:
                    currentHeaterCoolerState = this.hap.Characteristic.CurrentHeaterCoolerState.HEATING;
                    break;
                case Mode.FAN:
                case Mode.DRY:
                case Mode.AI:
                case Mode.AIRCLEAN:
                case Mode.ACO:
                case Mode.AROMA:
                case Mode.ENERGY_SAVING:
                case Mode.ENERGY_SAVER:
                    currentHeaterCoolerState = this.hap.Characteristic.CurrentHeaterCoolerState.IDLE;
                    break;
            }
        }
        callback(null, currentHeaterCoolerState)
    }

    private handleTargetHeaterCoolerStateGet(callback: CharacteristicGetCallback): void {
        //This is the same in this implementation!
        this.handleCurrentHeaterCoolerStateGet(callback);
    }

    private handleTargetHeaterCoolerStateSet(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
        if (!this.controller.isPoweredOn()) {
            this.powerStateWillChange = true;
        }

        switch (value) {
            case this.hap.Characteristic.TargetHeaterCoolerState.COOL:
                this.controller.setMode(Mode.COOL);
                break;
            case this.hap.Characteristic.TargetHeaterCoolerState.HEAT:
                this.controller.setMode(Mode.HEAT);
                break;
            case this.hap.Characteristic.TargetHeaterCoolerState.AUTO:
                break;
        }

        callback(null);
    }

    private handleCurrentTemperatureGet(callback: CharacteristicGetCallback): void {
        callback(null, this.controller.getCurrentTemperatureInCelsius());
    }

    private handleCoolingThresholdTemperatureGet(callback: CharacteristicGetCallback): void {
        callback(null, this.controller.getTargetCoolingTemperatureInCelsius());
    }

    private handleCoolingThresholdTemperatureSet(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
        if (!this.controller.isPoweredOn()) {
            this.powerStateWillChange = true;
        }

        this.controller.setTargetCoolingTemperatureInCelsius(value as number);
        callback(null);
    }

    private handleHeatingThresholdTemperatureGet(callback: CharacteristicGetCallback): void {
        callback(null, this.controller.getTargetHeatingTemperatureInCelsius());
    }

    private handleHeatingThresholdTemperatureSet(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
        if (!this.controller.isPoweredOn()) {
            this.powerStateWillChange = true;
        }

        this.controller.setTargetHeatingTemperatureInCelsius(value as number);
        callback(null);
    }

    private handleRotationSpeedGet(callback: CharacteristicGetCallback): void {
        callback(null, Math.round(WfracAdapter.fanSpeedToPercentage(this.controller.getFanSpeed())));
    }

    private handleRotationSpeedSet(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
        if (!this.controller.isPoweredOn()) {
            this.powerStateWillChange = true;
        }

        this.handleRotationSpeedSetWithDebounce(value);
        callback(null);
    }

    private handleSwingModeGet(callback: CharacteristicGetCallback): void {
        callback(null,
            this.controller.getHorizontalSwingMode() === HSwingMode.ALL &&
            this.controller.getVerticalSwingMode() === VSwingMode.ALL ?
                this.hap.Characteristic.SwingMode.SWING_ENABLED : this.hap.Characteristic.SwingMode.SWING_DISABLED
        );
    }

    private handleSwingModeSet(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
        if (!this.controller.isPoweredOn()) {
            this.powerStateWillChange = true;
        }

        setTimeout(async () => {
            if (value === this.hap.Characteristic.SwingMode.SWING_ENABLED) {
                await this.controller.setHorizontalSwingMode(HSwingMode.ALL);
                await AsyncUtils.sleep(2000);
                await this.controller.setVerticalSwingMode(VSwingMode.ALL);
            } else {
                await this.controller.setHorizontalSwingMode(HSwingMode.OFF);
                await AsyncUtils.sleep(2000);
                await this.controller.setVerticalSwingMode(VSwingMode.OFF);
            }
        });

        callback(null);
    }
}