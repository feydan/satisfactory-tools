import { DescribeInstancesCommand, EC2Client, StopInstancesCommand } from "@aws-sdk/client-ec2";
import { LambdaClient, GetFunctionUrlConfigCommand } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
const client = new EC2Client({ region: process.env.AWS_REGION });
const styleSheetLink = "https://cdn.simplecss.org/simple.min.css"

exports.handler = async function (event: any) {
  try {
    const serverList = process.env.SERVERS ? JSON.parse(process.env.SERVERS) : null

    const listInstances = new DescribeInstancesCommand({})
    const listInstancesOutput = await client.send(listInstances)

    const command = new GetFunctionUrlConfigCommand({ FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME });
    const lambdaFunction = await lambdaClient.send(command);

    if (event.queryStringParameters && event.queryStringParameters.stop && (/true/i).test(event.queryStringParameters.stop)) {

      const instanceList: string[] = [];

      listInstancesOutput.Reservations?.forEach((reservation: any) => {
        if (reservation.Instances) {
          reservation.Instances.forEach((instance: any) => {
            if (instance.State.Name == "running") {
              instanceList.push(instance.InstanceId)
            }
          })
        }
      })

      await client.send(new StopInstancesCommand({ InstanceIds: instanceList }))

      await new Promise(resolve => setTimeout(resolve, 10000));

      return {
        statusCode: 307,
        headers: {
          Location: lambdaFunction.FunctionUrl,
        }
      }
    }

    let runningInstance: any;
    let publicIpAddress: string | undefined;

    listInstancesOutput.Reservations?.forEach((reservation: any) => {
      if (reservation.Instances && reservation.Instances?.length > 0) {
        reservation.Instances.forEach((instance: any) => {
          if (instance.State.Name != "stopped") {
            runningInstance = instance
          }
        });
      }
    })

    if (runningInstance) {
      publicIpAddress = runningInstance.PublicIpAddress
    }

    let concatenated = ""

    if (serverList) {
      serverList.forEach((server: any) => {
        concatenated += `<li>
             <a href="${server.functionURL}?instanceid=${server.instanceID}"><h4>Start ${server.name} server</h4></a>
             <p>${server.description}</p>
           </li>`
      })
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html>
        <html>

        <head>
          <link rel="stylesheet" href="${styleSheetLink}" type="text/css">
          <title>Server</title>
        </head>

        <body>
        <header>
          <h1>Server Home Page</h1>
        </header>
          <main>
            <p>Server IP: ${publicIpAddress ? publicIpAddress : "No server online"}</p>
            <ul>${serverList ? concatenated : ""}</ul>
            <h4><a href="${lambdaFunction.FunctionUrl}?stop=true">Stop Instance</a></h4>
          </main>
        </body>
      </html>`
    }
  } catch (err) {
    console.log(err)
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><head><link rel="stylesheet" href="${styleSheetLink}" type="text/css"><title>Server</title></head><body><h1>Failed to start Satisfactory server</h1><pre>${JSON.stringify(err)}</pre></body></html>`
    }
  }
}