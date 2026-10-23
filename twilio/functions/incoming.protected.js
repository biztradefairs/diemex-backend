exports.handler = function (context, event, callback) {
  console.log(JSON.stringify({
    type: 'whatsapp_incoming', messageSid: event.MessageSid || null,
    mediaCount: Number(event.NumMedia || 0)
  }));
  const response = new Twilio.Response();
  response.setStatusCode(200);
  response.appendHeader('Content-Type', 'text/xml');
  response.setBody('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  callback(null, response);
};
