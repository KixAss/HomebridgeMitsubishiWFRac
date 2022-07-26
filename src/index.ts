import {API} from "homebridge";
import {ACCESSORY_NAME} from "./settings";
import {MitsubischiAirCoolerAccessory} from "./lg-airco-accessory";

export = (api: API) => {
    api.registerAccessory('homebridge-mitsubishi-wfrac', ACCESSORY_NAME, MitsubischiAirCoolerAccessory);
}
