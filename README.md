# Web Server for TruSense

This webserver is deployed on Render and has the following endpoints:

-   [POST] https://trusense-web-server.onrender.com/data
    -   receives data from the sensor and sends email alerts
-   [POST] https://trusense-web-server.onrender.com/settings/:topicId/:subscriberId
    -   receives settings from the website (subscriber email address and min and max values)
-   [POST] https://trusense-web-server.onrender.com/device-settings/:topicId
    -   receives the new measurement interval from the website
-   [GET] https://trusense-web-server.onrender.com/device-settings/:topicId
    -   sends the (new) measurement interval to the sensor

### Installation

1. **Clone and install dependencies**

```bash
npm i
```

2. **Set environment variables**

```
HEDERA_OPERATOR_ID="0.0...."
HEDERA_OPERATOR_KEY=
SENDGRID_API_KEY=
MAIL_SENDER="<a sendgrid verified email address>"
DATABASE_URL="postgresql://..."
```

3. **Start server**

```bash
npm run start
```
