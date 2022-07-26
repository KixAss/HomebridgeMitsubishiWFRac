const {Buffer} = require('buffer');
const {resolve} = require('path');
const {request} = require('request-promise');

export class WfracAdapter {

    //private readonly ip: string;
    private readonly debug: boolean;
    private readonly logDebug: Function;
    private readonly ip: string;
    private lastState: AirCoolerStatus;

    constructor(ip: string, debug: boolean, debugLogger: Function) {
        this.ip = ip;
        this.logDebug = debugLogger;
    }

    private async getAirconStat() {
        var url = 'http://'+this.ip+':51443/beaver/command/getAirconStat';
        var requestData = {'apiVer':'1.0','command':'getAirconStat','deviceId':'1234567890ABCDEF','operatorId':'d2bc4571-1cea-4858-b0f2-34c18bef1901','timestamp':Math.round(Date.now())};

        const jsonRequestOptions = {
            method: 'POST',
            uri: url,
            headers: {},
            json: true,
            data: requestData
        };

        await request(jsonRequestOptions)
            .then((json: object) => {
                this.logDebug(json);

                return json;
            })
            .catch(function (err: { message: any; }) {
				this.log('getStatusJson: ', err.message);
                return false;
            });
    }
    private async setAirconStat(command: string) {
        var url = 'http://'+this.ip+':51443/beaver/command/setAirconStat';
        var requestData = {'apiVer':'1.0','command':'setAirconStat','contents': { 'airconId':'a043b05ad1f2', 'airconStat':command },'deviceId':'a68d811862d2ef38','operatorId':'54302674-f763-4deb-bdba-46d8d92c152d','timestamp': Math.round(Date.now())};

        const jsonRequestOptions = {
            method: 'POST',
            uri: url,
            headers: {},
            json: true,
            data: requestData
        };

        await request(jsonRequestOptions)
            .then((json: object) => {
                this.logDebug(json);

                return json;
            })
            .catch(function (err: { message: any; }) {
                this.log('getStatusJson: ', err.message);
                return false;
            });
    }

    public static async listAirCoolers(ip: string): Promise<AirCooler> {
        return {
            deviceId: 'deviceId',
            deviceType: 'deviceType',
            modelName: 'modelName',
            ip: ip
        };
    }

    public async getStatus(deviceId: string): Promise<AirCoolerStatus> {
        try {
            const data = await this.getAirconStat();
            this.logDebug(data);

            // default values
            const response: AirCoolerStatus = {
                isOn: false,
                mode: Mode.AI,
                currentTempInCelsius: 0,
                targetTempInCelsius: 0,
                fanSpeed: FanSpeed.AUTO,
                powerUsage: 0,
                swingModeV: VSwingMode.ALL,
                swingModeH: HSwingMode.ALL
            };

            // parse data >> airConStatus
            // see https://github.com/jeatheak/Mitsubishi-WF-RAC-Integration/blob/7adae44029d25cf1e5c89523744d8704c7a08bd3/python/src/parser.py

            const responseBytes = new Buffer(data, 'base64');

            response.isOn = 1 == (3 & responseBytes[2]);
            response.targetTempInCelsius = responseBytes[4] / 2;

            switch (60 & responseBytes[2]) {
                case 8:
                    response.mode = Mode.AI;
                    break;
                case 16:
                    response.mode = Mode.AI;
                    break;
                case 12:
                    response.mode = Mode.AI;
                    break;
                case 4:
                    response.mode = Mode.AI;
                    break;
                default:
                    this.logDebug((60 & responseBytes[2]));
            }

            switch (15 & responseBytes[3]) {
                case 7:
                    response.fanSpeed = FanSpeed.AUTO;
                    break;
                case 0:
                    response.fanSpeed = FanSpeed.AUTO;
                    break;
                case 1:
                    response.fanSpeed = FanSpeed.AUTO;
                    break;
                case 2:
                    response.fanSpeed = FanSpeed.AUTO;
                    break;
                case 6:
                    response.fanSpeed = FanSpeed.AUTO;
                    break;
                default:
                    this.logDebug((15 & responseBytes[3]));
            }

            switch (240 & responseBytes[3]) {
                case 0:
                    response.swingModeV = VSwingMode.ALL;
                    break;
                case 16:
                    response.swingModeV = VSwingMode.ALL;
                    break;
                case 31:
                    response.swingModeV = VSwingMode.ALL;
                    break;
                case 48:
                    response.swingModeV = VSwingMode.ALL;
                    break;
                default:
                    this.logDebug((240 & responseBytes[3]));
            }

            switch (31 & responseBytes[11]) {
                case 0:
                    response.swingModeH = HSwingMode.ALL;
                    break;
                case 16:
                    response.swingModeH = HSwingMode.ALL;
                    break;
                case 31:
                    response.swingModeH = HSwingMode.ALL;
                    break;
                case 48:
                    response.swingModeH = HSwingMode.ALL;
                    break;
                default:
                    this.logDebug((240 & responseBytes[3]));
            }

            /*
                valueSegment = contentByteArray[startLength + 19:len(contentByteArray) - 2]

                if(len(valueSegment) >= 8):
                    ac.IndoorTemp = (Constants.indoorTemp[256 + valueSegment[2]])
                    ac.OutdoorTemp = (Constants.outdoorTemp[256 + valueSegment[6]])
                if(len(valueSegment) >= 11):
                    ac.Electric = (((valueSegment[11] << 8) + valueSegment[10]) * 0.25)
             */

            return response;
        } catch (error) {
            this.logDebug(error);
            return null;
        }
    }
    public async setStatus(deviceId: string, airConStatus: AirCoolerStatus): Promise<AirCoolerStatus> {
        try {
            // airConStatus >> text

            const requestBytes = new Buffer.from([0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // default
            requestBytes[2] = (airConStatus ? 3 : 2);

            const requestData = requestBytes.toString('base64');

            const data = await this.setAirconStat(requestData);
            this.logDebug(data);

            return ;
        } catch (error) {
            this.logDebug(error);
            return null;
        }
    }

    public async setPowerOnOff(deviceId: string, poweredOn: boolean): Promise<boolean> {
        try {
            const newState = this.lastState;
            newState.isOn = poweredOn;
            const data = this.setStatus(deviceId, newState);

            this.logDebug(data);

            this.lastState = newState;

            return true;
        } catch (error) {
            this.logDebug(error);
            return false;
        }
    }

    public async setTargetTemperature(deviceId: string, temperatureInCelsius: number): Promise<boolean> {
        try {
            const newState = this.lastState;
            newState.targetTempInCelsius = temperatureInCelsius;
            const data = this.setStatus(deviceId, newState);

            this.logDebug(data);

            this.lastState = newState;
            return true;
        } catch (error) {
            this.logDebug(error);
            return false;
        }
    }

    public async setMode(deviceId: string, mode: Mode): Promise<boolean> {
        try {
            const newState = this.lastState;
            newState.mode = mode;
            const data = this.setStatus(deviceId, newState);

            this.logDebug(data);

            this.lastState = newState;

            return true;
        } catch (error) {
            this.logDebug(error);
            return false;
        }
    }

    public async setFanSpeed(deviceId: string, fanSpeed: FanSpeed): Promise<boolean> {
        try {
            const newState = this.lastState;
            newState.fanSpeed = fanSpeed;
            const data = this.setStatus(deviceId, newState);

            this.logDebug(data);

            this.lastState = newState;
            return true;
        } catch (error) {
            this.logDebug(error);
            return false;
        }
    }

    public async setSwingModeV(deviceId: string, swingModeV: VSwingMode): Promise<boolean> {
        try {
            const newState = this.lastState;
            newState.swingModeV = swingModeV;
            const data = this.setStatus(deviceId, newState);

            this.logDebug(data);

            this.lastState = newState;
            return true;
        } catch (error) {
            this.logDebug(error);
            return false;
        }
    }

    public async setSwingModeH(deviceId: string, swingModeH: HSwingMode): Promise<boolean> {
        try {
            const newState = this.lastState;
            newState.swingModeH = swingModeH;
            const data = this.setStatus(deviceId, newState);

            this.logDebug(data);

            this.lastState = newState;

            return true;
        } catch (error) {
            this.logDebug(error);
            return false;
        }
    }

    public static fanSpeedToPercentage(fanSpeed: FanSpeed): number {
        switch (fanSpeed) {
            case FanSpeed.SLOW:
                return 12.5;
            case FanSpeed.SLOW_LOW:
                return 25;
            case FanSpeed.LOW:
                return 37.5;
            case FanSpeed.LOW_MID:
                return 50;
            case FanSpeed.MID:
                return 62.5;
            case FanSpeed.MID_HIGH:
                return 75;
            case FanSpeed.HIGH:
                return 87.5;
            case FanSpeed.POWER:
                return 100;

            case FanSpeed.AUTO:
            case FanSpeed.NATURE:
            case FanSpeed.R_LOW:
            case FanSpeed.R_MID:
            case FanSpeed.R_HIGH:
            case FanSpeed.L_LOW:
            case FanSpeed.L_MID:
            case FanSpeed.L_HIGH:
            case FanSpeed.L_LOWR_LOW:
            case FanSpeed.L_LOWR_MID:
            case FanSpeed.L_LOWR_HIGH:
            case FanSpeed.L_MIDR_LOW:
            case FanSpeed.L_MIDR_MID:
            case FanSpeed.L_MIDR_HIGH:
            case FanSpeed.L_HIGHR_LOW:
            case FanSpeed.L_HIGHR_MID:
            case FanSpeed.L_HIGHR_HIGH:
            case FanSpeed.AUTO_2:
            case FanSpeed.POWER_2:
            case FanSpeed.LONGPOWER:
                return 0;
        }
    }

    public static percentageToFanSpeed(percentage: number): FanSpeed {
        if (percentage <= 12.5) {
            return FanSpeed.SLOW;
        } else if (percentage <= 25) {
            return FanSpeed.SLOW_LOW;
        } else if (percentage <= 37.5) {
            return FanSpeed.LOW;
        } else if (percentage <= 50) {
            return FanSpeed.LOW_MID;
        } else if (percentage <= 62.5) {
            return FanSpeed.MID;
        } else if (percentage <= 75) {
            return FanSpeed.MID_HIGH;
        } else if (percentage <= 87.5) {
            return FanSpeed.HIGH;
        } else if (percentage <= 100) {
            return FanSpeed.POWER;
        }
    }
}

export interface AirCooler {
    deviceId: string;
    deviceType: string;
    modelName: string;
    ip: string;
}

export interface AirCoolerStatus {
    isOn: boolean
    mode: Mode,
    currentTempInCelsius: number,
    targetTempInCelsius: number,
    fanSpeed: FanSpeed,
    powerUsage: number,
    swingModeV: VSwingMode,
    swingModeH: HSwingMode
}

/*
* WIDEQ AC related enums
* Please check ac.py for updated values & documentation
**/

export enum HSwingMode {
    OFF = "OFF",
    ONE = "ONE",
    TWO = "TWO",
    THREE = "THREE",
    FOUR = "FOUR",
    FIVE = "FIVE",
    LEFT_HALF = "LEFT_HALF",
    RIGHT_HALF = "RIGHT_HALF",
    ALL = "ALL",
}

export enum VSwingMode {
    OFF = "OFF",
    ONE = "ONE",
    TWO = "TWO",
    THREE = "THREE",
    FOUR = "FOUR",
    FIVE = "FIVE",
    SIX = "SIX",
    ALL = "ALL"
}

export enum Mode {
    COOL = "COOL",
    DRY = "DRY",
    FAN = "FAN",
    AI = "AI",
    HEAT = "HEAT",

    //TODO: Figure out which mode settings actually work!
    AIRCLEAN = "AIRCLEAN",
    ACO = "ACO",
    AROMA = "AROMA",
    ENERGY_SAVING = "ENERGY_SAVING",
    ENERGY_SAVER = "ENERGY_SAVER",
}

export enum FanSpeed {
    SLOW = 'SLOW',
    SLOW_LOW = 'SLOW_LOW',
    LOW = 'LOW',
    LOW_MID = 'LOW_MID',
    MID = 'MID',
    MID_HIGH = 'MID_HIGH',
    HIGH = 'HIGH',

    //TODO: Figure out which fan speed settings actually work!
    POWER = 'POWER',
    AUTO = 'AUTO',
    NATURE = 'NATURE',
    R_LOW = 'R_LOW',
    R_MID = 'R_MID',
    R_HIGH = 'R_HIGH',
    L_LOW = 'L_LOW',
    L_MID = 'L_MID',
    L_HIGH = 'L_HIGH',
    L_LOWR_LOW = 'L_LOWR_LOW',
    L_LOWR_MID = 'L_LOWR_MID',
    L_LOWR_HIGH = 'L_LOWR_HIGH',
    L_MIDR_LOW = 'L_MIDR_LOW',
    L_MIDR_MID = 'L_MIDR_MID',
    L_MIDR_HIGH = 'L_MIDR_HIGH',
    L_HIGHR_LOW = 'L_HIGHR_LOW',
    L_HIGHR_MID = 'L_HIGHR_MID',
    L_HIGHR_HIGH = 'L_HIGHR_HIGH',
    AUTO_2 = 'AUTO_2',
    POWER_2 = 'POWER_2',
    LONGPOWER = 'LONGPOWER'
}