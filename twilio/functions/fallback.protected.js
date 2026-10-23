exports.handler = function (context, event, callback) {
  console.warn(JSON.stringify({
    type: 'whatsapp_webhook_fallback', messageSid: event.MessageSid || null,
    errorCode: event.ErrorCode || null
  }));
  const response = new Twilio.Response();
  response.setStatusCode(200);
  response.appendHeader('Content-Type', 'text/xml');
  response.setBody('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  callback(null, response);
};
