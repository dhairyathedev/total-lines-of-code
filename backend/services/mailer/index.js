require("dotenv").config();
const { Worker } = require("bullmq");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);



const connection = {
    host: process.env.REDIS_HOST,
    port: 6379,
    password: process.env.REDIS_PASSWORD,
};

const worker = new Worker("mail-queue", async (job) => {
    console.log(process.env.RESEND_API_KEY);
    const { email, totalLines, error, userId } = job.data;
    console.log(`Sending email to ${email ? email : "hello@dhairyashah.dev"}`);

    await resend.emails.send({
        from: "projects@notifications.dhairyashah.dev",
        to: email ? email : "hello@dhairyashah.dev",
        replyTo: "hello@dhairyashah.dev",
        subject: "TotalLinesOfCode Line Count Report",
        html: `
            <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html dir="ltr" lang="en"><head><meta content="width=device-width" name="viewport"/><meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/><meta name="x-apple-disable-message-reformatting"/><meta content="IE=edge" http-equiv="X-UA-Compatible"/><meta name="x-apple-disable-message-reformatting"/><meta content="telephone=no,address=no,email=no,date=no,url=no" name="format-detection"/><meta content="light" name="color-scheme"/><meta content="light" name="supported-color-schemes"/><!--$--><style>
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      mso-font-alt: 'sans-serif';
      src: url(https://rsms.me/inter/font-files/Inter-Regular.woff2?v=3.19) format('woff2');
    }

    * {
      font-family: 'Inter', sans-serif;
    }
  </style><style>blockquote,h1,h2,h3,img,li,ol,p,ul{margin-top:0;margin-bottom:0}</style></head><body style="margin:0"><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:600px;min-width:300px;width:100%;margin-left:auto;margin-right:auto;padding:0.5rem"><tbody><tr style="width:100%"><td><h2 style="text-align:left;color:#111827;margin-bottom:12px;margin-top:0;font-size:30px;line-height:36px;font-weight:700"><strong>totallinesofcode...</strong></h2><p style="font-size:15px;line-height:24px;margin:16px 0;text-align:left;margin-bottom:20px;margin-top:0px;color:#374151;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">Thank you for waiting...</p><p style="font-size:15px;line-height:24px;margin:16px 0;text-align:left;margin-bottom:20px;margin-top:0px;color:#374151;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">Your code analysis has been completed. Here are the results:</p><h3 style="text-align:left;color:#111827;margin-bottom:12px;margin-top:0;font-size:24px;line-height:38px;font-weight:600">${totalLines} lines written</h3><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:100%;text-align:left;margin-bottom:0px"><tbody><tr style="width:100%"><td><a href="https://totallinesofcode.dhairyashah.dev" style="line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px;color:#ffffff;background-color:#000000;border-color:#000000;padding:12px 34px 12px 34px;border-width:2px;border-style:solid;font-size:14px;font-weight:500;border-radius:9999px" target="_blank"><span><!--[if mso]><i style="mso-font-width:425%;mso-text-raise:18" hidden>&#8202;&#8202;&#8202;&#8202;</i><![endif]--></span><span style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:9px">Share with your friends</span><span><!--[if mso]><i style="mso-font-width:425%" hidden>&#8202;&#8202;&#8202;&#8202;&#8203;</i><![endif]--></span></a></td></tr></tbody></table><table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:37.5em;height:64px"><tbody><tr style="width:100%"><td></td></tr></tbody></table><p style="font-size:15px;line-height:24px;margin:16px 0;text-align:left;margin-bottom:20px;margin-top:0px;color:#374151;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">Thank you for using!</p><p style="font-size:15px;line-height:24px;margin:16px 0;text-align:left;margin-bottom:20px;margin-top:0px;color:#374151;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">Regards,<br/>Dhairya Shah<br/></p></td></tr></tbody></table><!--/$--></body></html>
        `,
    }).then((data) => {
        console.log(data);
    }).catch((error) => {
        console.log(error);
    });
}, {
    connection
});

worker.on("completed", (jobId) => {
    console.log(`Email Job ${jobId} completed`);
});

module.exports = worker;