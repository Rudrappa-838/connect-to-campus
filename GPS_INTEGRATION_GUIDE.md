# GPS Integration Guide for School Software

This guide explains how to connect your existing School Bus GPS Hardware Trackers to the School Software for Live Tracking.

## 1. Identify Your GPS Device Type

Your GPS tracker sends location data in one of two ways:
- **HTTP Webhook (Modern/Smart):** Sends data as JSON to a URL. (Easy to integrate)
- **TCP Socket (Standard/Legacy):** Sends raw data packets to an IP:Port. (Requires middleware)

---

## 2. Setting Up HTTP Webhook Devices (Easiest)

If your device supports configurable HTTP/URL endpoints (e.g., Teltonika, Ruptela, some Concox models):

### Step A: Configure the Device
Log in to your GPS Device Configurator (PC Tool or SMS Command) and set the **Server Settings**:

- **Server URL / IP:** `http://YOUR_AWS_PUBLIC_IP:5000/api/transport/gps/webhook`
  *(Replace `YOUR_AWS_PUBLIC_IP` with your actual server IP, e.g. 13.233.177.5)*
- **Protocol:** HTTP POST
- **Data Format:** JSON (if customizable)

**Expected JSON Payload:**
The device must send a JSON body with keys `imei`, `lat`, and `lng`.
```json
{
  "imei": "123456789012345",
  "lat": 12.9716,
  "lng": 77.5946,
  "speed": 45,
  "timestamp": "2026-02-11T10:00:00Z"
}
```

### Step B: Register Device in Software
1. Open **School Software > Transport > Vehicles**.
2. Edit or Add a Vehicle.
3. In the **GPS Device ID / IMEI** field, enter the exact IMEI of the device.
4. Save.

---

## 3. Connecting Standard TCP Devices (Traccar Integration)

Most cheap GPS trackers (GT06, TK103, Watch Protocol) send raw TCP data. You cannot connect them directly to our API. You need a **Middleware**.

We recommend using **Traccar** (Free Open Source GPS Server).

### Step A: Install Traccar (on AWS)
You can install Traccar on the same AWS server or a separate small instance to handle raw GPS protocols.

### Step B: Configure Traccar Forwarding
In `traccar.xml` config file, enable event forwarding to our School Software:

```xml
<entry key='forward.enable'>true</entry>
<entry key='forward.url'>http://YOUR_AWS_PUBLIC_IP:5000/api/transport/gps/webhook</entry>
<entry key='forward.json'>true</entry>
```

This effectively converts raw TCP data from thousands of device models into the JSON Webhook format our software understands!

---

## 4. Connecting via 3rd Party Provider (TrackSolid, Wialon, etc.)

If you already pay for a GPS Portal (like TrackSolid, Amber, etc.), do NOT change the device settings.

Instead, ask your provider for their **API Documentation** (Pull API).
We can write a simple script to fetch bus locations from their server every 10 seconds.

**Information Needed:**
1.  **Provider Name** (Website URL)
2.  **API Key / Username & Password**
3.  **Device IMEIs**

---

## 5. Testing the Integration (Mock Test)

You can test if the system is working without a real bus by simulating a GPS signal using `curl` command in your terminal.

**Run this command:**
```bash
# Replace IMEI with a value you entered in the Vehicle form
curl -X POST http://localhost:5000/api/transport/gps/webhook \
  -H "Content-Type: application/json" \
  -d '{"imei": "TEST_BUS_01", "lat": 12.9720, "lng": 77.5950, "speed": 60}'
```

If successful, you will see `{"message": "Location updated via GPS Hardware"}` and the bus will move on the dashboard map!
