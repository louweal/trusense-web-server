# Web Server for TruSense

This webserver runs on Render and has the following endpoints:

-   [POST] https://trusense-web-server.onrender.com/data - receives data from the sensor and sends email alerts
-   [POST] https://trusense-web-server.onrender.com/settings/:topicId/:subscriberId - receives settings from the website (subscriber email address and min and max values)
-   [POST] https://trusense-web-server.onrender.com/device-settings/:topicId - receives the new measurement interval from the website
-   [GET] https://trusense-web-server.onrender.com/device-settings/:topicId - sends the (new) measurement interval to the sensor

### Installation

1. **Clone and install dependencies**

```bash
npm i
```

2. **Set environment variables**

See .env.sample for details.

3. **Start server**

```bash
npm run start
```
