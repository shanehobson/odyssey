export const handler = async (event: any) => {
  console.log('Test handler invoked with event:', JSON.stringify(event));
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Test handler working!',
      path: event.path || event.rawPath,
      method: event.httpMethod || event.requestContext?.http?.method,
    }),
  };
};