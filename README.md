# hassio-ring-bridge

Ring Bridge for Home Assistant, exposing get/set of location mode. The Ring token is automatically refreshed.

The bridge can be used to automatically set the Ring location mode based on automatic presence detection of residents to enable a mixed sensor and fully automatic alarming system at home such as the following.

![alt text](https://raw.githubusercontent.com/helmut-hoffer-von-ankershoffen/hassio-ring-bridge/master/ring-bridge/dashboard.png "Automatic setting of Ring location mode based on automatic presence detection of residents.")

## Installation

1) In Home Assistant go to `Supervisor` > `Add-on Store` > dots top-right > `Repositories` and add the repository URL `https://github.com/helmut-hoffer-von-ankershoffen/hassio-ring-bridge`.
2) Click on `Ring Bridge` > `INSTALL` > Wait for a few min, as Docker container with NodeJS webservice is built locally.
3) While you wait, call `npx -p ring-client-api ring-auth-cli` on your Mac or Windows machine to generate a refresh token. When generated click on `Configuration`, set the value of `refresh_token` to the token generated and click `SAVE`.
4) Click on `START` after enabling `Watchdog` and optionally `Auto update`. Click on `LOGS` and `REFRESH` to see everything is working as expected.

## Sensor

Add the following to `configuration.yaml` of Home Assistant and restart:

```yaml
sensor:
  - platform: rest
    name: ring_location_mode
    resource: http://127.0.0.1:8000/location-mode
    value_template: '{{ value_json.mode }}'
```

For lovelace

```yaml
type: entities
entities:
  - entity: sensor.ring_location_mode
    name: Ring Modus
    icon: 'hass:shield'
```

## Service

Add the following to `configuration.yaml` of Home Assistant and restart:

```yaml
rest_command:
  ring_location_mode:
    url: http://127.0.1:8000/location-mode
    method: POST
    payload: '{"mode": "{{ mode }}"}'
    content_type:  'application/json; charset=utf-8'
```

## Automation

Automatically set the Ring location mode depending on the presence of residents by adding an automation as follows:

```yaml
alias: Ring location mode update on resident not present and armed
description: ''
trigger:
  - platform: state
    entity_id: input_boolean.resident_present
    to: 'off'
  - platform: state
    entity_id: input_select.alarm_system
    from: Aus
  - platform: state
    entity_id: input_select.alarming_mode
    from: Nur Dashboard
condition:
  - condition: state
    entity_id: input_boolean.resident_present
    state: 'off'
  - condition: not
    conditions:
      - condition: state
        entity_id: input_select.alarming_mode
        state: Nur Dashboard
  - condition: not
    conditions:
      - condition: state
        entity_id: input_select.alarm_system
        state: Aus
action:
  - service: rest_command.ring_location_mode
    data:
      mode: away
mode: single
```

```yaml
alias: Ring location mode update on resident present or not armed
description: ''
mode: single
trigger:
  - platform: state
    entity_id: input_boolean.resident_present
    to: 'on'
  - platform: state
    entity_id: input_select.alarming_mode
    to: Nur Dashboard
  - platform: state
    entity_id: input_select.alarm_system
    to: Aus
condition:
  - condition: or
    conditions:
      - condition: state
        entity_id: input_boolean.resident_present
        state: 'on'
      - condition: state
        entity_id: input_select.alarming_mode
        state: Nur Dashboard
      - condition: state
        entity_id: input_select.alarm_system
        state: Aus
action:
  - service: rest_command.ring_location_mode
    data:
      mode: home
```

The automation serves as an inspiration. It assumes the following:
1) The residents presence is mapped to `resident_present` by additional automation rules.
2) The alarm system can be (dis)armed by residents as represented in `alarm_system` with `Aus` representing the disarmed state.
3) The alarming channels can be set by residents with `Nur Dashboard` defining alarms should be signaled in the Home Assistant dashboard only, i.e. no notifications sent out by Ring or Hassio.

## Builders

1) Leverages the NodeJS ring-api-client <https://github.com/dgreif/ring> from dgreif <https://github.com/dgreif/ring>.
2) Can be easily extended to expose more than get/set locations. Have a look at the index.js as a starter.