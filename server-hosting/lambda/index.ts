import { DescribeInstancesCommand, EC2Client, StartInstancesCommand } from "@aws-sdk/client-ec2";

const instanceId = process.env.INSTANCE_ID
const client = new EC2Client({ region: process.env.AWS_REGION });
const command = new StartInstancesCommand({ InstanceIds: [instanceId!] });

exports.handler = async function (event: any) {

  console.log("Attempting to start game server", instanceId);

  return client.send(command)
    .then(async (res) => {

      await new Promise(resolve => setTimeout(resolve, 10000));

      const ipCommand = new DescribeInstancesCommand({
        InstanceIds: [instanceId!]
      })

      return client.send(ipCommand)
        .then((resIP => {

          return {
            statusCode: 200,
            headers: { "Content-Type": "text/json" },
            body: JSON.stringify({
              message: "Started satisfactory server",
              response: JSON.stringify(res),
              address: resIP.Reservations?.[0].Instances?.[0].PublicIpAddress
            })
          }
        }))
    })
    .catch((err) => {
      console.log(JSON.stringify(err));
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/json" },
        body: JSON.stringify({ message: "Failed to start satisfactory server", response: JSON.stringify(err) })
      }
    });
}