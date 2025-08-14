exports.handler = async (event) => {
    console.log('Event Processor - Hello World!');
    console.log('Received SQS event:', JSON.stringify(event, null, 2));
    
    for (const record of event.Records) {
        console.log('Processing message:', record.body);
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Hello from Event Processor!',
            processedRecords: event.Records.length,
        }),
    };
};