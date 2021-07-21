---
layout: post
title:  "Project idea: Wirelessly readable real-time temperature and humidity sensor"
date:   2021-07-19 00:30:00 +0300
categories: website
---


Project idea: Wirelessly readable real-time temperature and humidity sensor
==================
A wireless temperature and humidity indicator  requires a microcontroller that reads temperature and humidity data from a sensor.

The sensor can either transmit raw data (ie. voltage depending on the temperature) or serialized data (another circuit that translates raw data to a form that is easier to be used).

Now that we have a microcontroller and a sensor, we need to find a way to power this system, and to transmit the data somewhere we can read it and make conclusions about it.

Since we have defined the system to be wireless, it uses an independent power source. Since we don't need it to work forever, a battery is sufficient. To make sure the voltage between the microcontroller and battery are compatible, we also should use a voltage regulator.

We also want to be able to read the data in real-time. This requires a wireless connection to the internet. We don't want to spend any extra money monthly for keeping the connection up, so we are limited to WLAN, and areas that have free WLAN.

Components used are planned to be as follows:
 - Power: [Panasonic NCR18650B 3,7 V Li-Ionen Akku mit PCB Schutzelektronik 3400mAh 6,8A](https://www.ebay.com/itm/265143180192)
 - Microcontroller (with wifi): [NodeMCU V3.4 ESP8266 ESP-12 E Lua CH340 WiFI WLan IoT Arduino Lolin Mini Micro](https://www.ebay.com/itm/252718027546)
 - Temperature & humidity sensor: [DHT22/AM2302 Digital Temperature and Humidity Sensor Replace New SHT11 W2H3](https://www.ebay.com/itm/363473330848)
 - Voltage regulator [10Pcs Ht7333-A 7333-A Ht7333 Ht7333A-1 To92 Low Power Consumption Ldo S&K](https://www.ebay.com/itm/362691790010)
 - Some wires and a case.

The components above should be all we need for the hardware side. Schematic for the connections of the components is not discussed here.

Software is split into two parts; microcontroller and the outside. The microcontroller is required to transmit the data collected from the sensor in a predefined form to work as an independent data source able to communicate with a larger network. The outside is responsible for storing and representing the data. Software is not discussed further.


For the future reference, here are some pointers about what to go deeper with possibly:
 - Schematics
 - Documentation based on easy reproducibility
 - Building process
 - Testing process
 - Pros and cons about the components used, and reflection about improvement
 - Software for the microcontroller
 - API definitions
 - Representation and accessibility of the data
 - Minimizing power usage to make batteries last longer between charges
 - Literature review -based reflection instead of massive testing
 - Feasibility of the system to be used in real world

Links
==================

A project similar to this: [Battery Powered ESP8266 WiFi Temperature and Humidity Logger](https://tzapu.com/minimalist-battery-powered-esp8266-wifi-temperature-logger/)
