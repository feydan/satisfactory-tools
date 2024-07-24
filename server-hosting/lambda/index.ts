import { DescribeInstancesCommand, EC2Client, StartInstancesCommand } from "@aws-sdk/client-ec2";
import { CostExplorerClient, GetCostAndUsageCommand, GetCostAndUsageCommandInput } from "@aws-sdk/client-cost-explorer";

const instanceId = process.env.INSTANCE_ID
const client = new EC2Client({ region: process.env.AWS_REGION });
const command = new StartInstancesCommand({ InstanceIds: [instanceId!] });
const clientPricing = new CostExplorerClient();


exports.handler = async function (event: any) {

  console.log("Attempting to start game server", instanceId);
  try {
    const month = new Date().getMonth() + 1
    const textMonth = month < 10 ? `0${month}` : month;
    const year = new Date().getFullYear()
    const d = new Date(year, month + 1, 0).getDate()

    const commandCost = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: `${year}-${textMonth}-01`,
        End: `${year}-${textMonth}-${d}`
      },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
      Filter: {
        Dimensions: {
          Key: "SERVICE",
          Values: [
            "Amazon Elastic Compute Cloud - Compute",
            "EC2 - Other",
            "Amazon Virtual Private Cloud"
          ]
        }
      }
    } as GetCostAndUsageCommandInput)

    const costEstimate = await clientPricing.send(commandCost)

    if (parseFloat(costEstimate.ResultsByTime?.[0].Total?.UnblendedCost.Amount!) >= 20)
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/json" },
        body: JSON.stringify({ message: "Cost have been above the defined spending budget this month. To be allowed to spend more, please contact an administrator." })
      }

    const EC2command = await client.send(command)
    await new Promise(resolve => setTimeout(resolve, 10000));

    const ipCommand = new DescribeInstancesCommand({
      InstanceIds: [instanceId!]
    })

    const resIP = await client.send(ipCommand)
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/json" },
      body: JSON.stringify({
        message: "Started satisfactory server",
        response: JSON.stringify(EC2command),
        address: resIP.Reservations?.[0].Instances?.[0].PublicIpAddress
      })
    }
  } catch (err) {
    console.log(JSON.stringify(err));
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/json" },
      body: JSON.stringify({ message: "Failed to start satisfactory server", response: JSON.stringify(err) })
    }
  }
}