import { DescribeInstancesCommand, EC2Client, StartInstancesCommand } from "@aws-sdk/client-ec2";
import { LambdaClient, GetFunctionUrlConfigCommand } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
const instanceId = process.env.INSTANCE_ID
const client = new EC2Client({ region: process.env.AWS_REGION });
const command = new StartInstancesCommand({ InstanceIds: [instanceId!] });
const styleSheetLink = "https://unpkg.com/styled-css-base/presets/simple/index.css"

exports.handler = async function (event: any) {
  try {
    const listInstances = new DescribeInstancesCommand({})
    const listInstancesOutput = await client.send(listInstances)
    let alreadyRunning: boolean = false

    listInstancesOutput.Reservations?.forEach((reservation: any) => {
      if (reservation.Instances && reservation.Instances?.length > 0) {
        reservation.Instances.forEach((instance: any) => {
          console.log(JSON.stringify(instance))
          if (instance.State.Name != "stopped") {
            alreadyRunning = true
          }
        });
      }
    })


    const commandLambda = new GetFunctionUrlConfigCommand({ FunctionName: process.env.ROOT_FUNCTION_NAME });
    const response = await lambdaClient.send(commandLambda);

    if (alreadyRunning) {
      return {
        statusCode: 307,
        headers: {
          Location: response.FunctionUrl,
        }
      }
    }

    await client.send(command)
    await new Promise(resolve => setTimeout(resolve, 10000));

    return {
      statusCode: 307,
      headers: {
        Location: response.FunctionUrl,
      }
    }
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><head><link rel="stylesheet" href="${styleSheetLink}" type="text/css"><title>Server</title></head><body><h1>Failed to start Satisfactory server</h1><pre>${JSON.stringify(err)}</pre></body></html>`
    }
  }
}