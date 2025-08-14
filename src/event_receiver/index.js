exports.handler = async (event) => {
    console.log('Event Receiver - Hello World!');
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    const response = {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Hello from Event Receiver!',
            input: event,
        }),
    };
    
    return response;
};