const AWS = require("aws-sdk");
const sns = new AWS.SNS({ apiVersion: "2010-03-31" });

const { SNS_TOPIC_ARN } = process.env;

exports.handler = async (event) => {
  for (const record of event.Records || []) {
    try {
      const msg = JSON.parse(record.body || "{}");

      if (msg.type === "Emergency") {
        console.log(
          JSON.stringify({
            level: "INFO",
            event: "emergency_received",
            event_id: msg.event_id,
            vehicle_plate: msg.vehicle_plate,
            coordinates: msg.coordinates,
            received_at_utc: msg.received_at_utc,
            source: "processor",
          })
        );

        const emailSentAt = new Date().toISOString();
        const subject = "🚨 Emergency Event Detected";
        const text = `Se recibió un evento "Emergency".
        event_id: ${msg.event_id}
        vehicle_plate: ${msg.vehicle_plate}
        coordinates: (${msg.coordinates?.latitude}, ${
          msg.coordinates?.longitude
        })
        status: ${msg.status ?? "N/A"}
        received_at_utc: ${msg.received_at_utc}
        email_sent_at_utc: ${emailSentAt}`;

        await sns
          .publish({
            TopicArn: SNS_TOPIC_ARN,
            Subject: subject,
            Message: text,
          })
          .promise();

        const latencyMs = Date.now() - Date.parse(msg.received_at_utc);
        console.log(
          JSON.stringify({
            level: "INFO",
            event: "email_sent",
            event_id: msg.event_id,
            to: "SNS->Gmail",
            provider: "sns",
            email_sent_at_utc: emailSentAt,
            latency_ms_from_receive: latencyMs,
          })
        );
      }
    } catch (e) {
      console.error(
        JSON.stringify({
          level: "ERROR",
          event: "process_failed",
          error: String(e),
        })
      );
      throw e;
    }
  }

  return { statusCode: 200 };
};
