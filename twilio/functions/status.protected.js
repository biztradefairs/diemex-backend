exports.handler = function (context, event, callback) {
  console.log(JSON.stringify({
    type: 'whatsapp_delivery_status', messageSid: event.MessageSid || null,
    status: event.MessageStatus || event.SmsStatus || null,
    errorCode: event.ErrorCode || null
  }));
  const response = new Twilio.Response();
  response.setStatusCode(204);
  response.setBody('');
  callback(null, response);
};
