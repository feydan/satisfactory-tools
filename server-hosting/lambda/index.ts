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
    const d = new Date(year, month, 0).getDate()

    const commandCost = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: `${year}-${textMonth}-01`,
        End: `${year}-${textMonth}-${d}`
      },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost", "UsageQuantity"],
      Filter: {
        Dimensions: {
          Key: "SERVICE",
          Values: [
            "Amazon Elastic Compute Cloud - Compute",
            "EC2 - Other",
            "Amazon Virtual Private Cloud"
          ]
        }
      },
      "GroupBy":[
        {
          "Type":"DIMENSION",
          "Key":"SERVICE"
        }
      ]
    } as GetCostAndUsageCommandInput)

    const costEstimate = await clientPricing.send(commandCost)
    
    const totalBilling = costEstimate.ResultsByTime?.[0].Groups?.reduce((sum, current) => sum + parseFloat(current.Metrics?.UnblendedCost.Amount!), 0);

    // if (totalBilling! >= 20)
    //   return {
    //     statusCode: 200,
    //     headers: { "Content-Type": "text/json" },
    //     body: JSON.stringify({ message: "Cost have been above the defined spending budget this month. To be allowed to spend more, please contact an administrator." })
    //   }

    await client.send(command)
    await new Promise(resolve => setTimeout(resolve, 10000));

    const ipCommand = new DescribeInstancesCommand({
      InstanceIds: [instanceId!]
    })

    const resIP = await client.send(ipCommand)
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><head><style>body{background:#f7f7f7;background:-moz-linear-gradient(45deg,#f7f7f7 0,#eae0d5 100%);background:-webkit-linear-gradient(45deg,#f7f7f7 0,#eae0d5 100%);background:linear-gradient(45deg,#f7f7f7 0,#eae0d5 100%)}.header{background-image:url(efad1a91.jpg);height:400px;background-position:center center}h1{color:#e80410;color:rgba(232,4,16,.75);font-family:'Covered By Your Grace',sans-serif;font-size:100px;line-height:76px;position:relative;text-align:center;top:20%}h2{color:#e4bb97;Background-color:#aa8eb5;font-family:Raleway,sans-serif;font-size:28px;font-weight:500;text-align:left;text-transform:uppercase}ul{margin:0 auto;padding:0;width:50%}li{border-bottom:1px solid #e4bb97;list-style:none;margin:100px 0;padding-bottom:60px}p{color:#444;line-height:32px;font-family:Raleway,sans-serif;font-size:20px;font-weight:100}a{color:#214e34;font-family:Raleway,sans-serif;font-size:13px;font-weight:900;text-align:left;text-transform:uppercase;text-decoration:none;letter-spacing:2px}</style><title>Serveur</title></head><body><h1>Serveur lanc&eacute; avec succ&egrave;s</h1><p>IP du serveur: ${resIP.Reservations?.[0].Instances?.[0].PublicIpAddress}</p><p>Montant facture mensuel: ${totalBilling}$</p><p>Temps de jeu approximatif mensuel: ${costEstimate.ResultsByTime?.[0].Groups?.[2].Metrics?.UsageQuantity.Amount} heures</p></body></html>`
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