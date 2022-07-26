# Homebridge Mitsubishi WF-RAC Airconditioning

This Homebridge plugin allows control over a Mitsubishi airco unit with WF-RAC wifi-module.

To install this plugin simple type `sudo npm install homebridge-mitsubishi-wfrac -g --unsafe-perm=true`.
Next open the config.json that contains your Homebridge configuration and add a block like the following one to the accessories array:

```json
{
    "accessory": "AirCooler",
    "name": "MitsubishiWFRacAirco",
    "ip": "192.168.0.0",
    "maxCoolingTemp": 26,
    "minCoolingTemp": 18,
    "maxHeatingTemp": 30,
    "minHeatingTemp": 5,
    "updateInterval": 60000,
    "debug": false
}
```

The accessory name has to be `LgAirCooler` to link to the plugin.  
The `name` field is for the display name in the HomeKit app.  
The `ip` field is the IP-address of the unit.  
The `maxCoolingTemp` field is the maximum settable temperature when in COOLING mode.  
The `minCoolingTemp` field is the minimum settable temperature when in COOLING mode.  
The `maxHeatingTemp` field is the maximum settable temperature when in HEATING mode.  
The `minHeatingTemp` field is the minimum settable temperature when in HEATING mode.  
The `updateInterval` field is the interval that is used to fetch new state data from the AC unit. In milliseconds!  
The `debug` field is the boolean that enables or disables debug logging, set this to false unless collecting logs.  

The initial state will be fetched shortly after booting your Homebridge instance.
After that an update of the state is performed every minute.

## Requirements

- A compatible airco unit

## Credits

For the bases of the plugin I used: https://github.com/beele/HomebridgeLgSmartThinqAirco
For the WF-RAC communication i used: https://github.com/jeatheak/Mitsubishi-WF-RAC-Integration
