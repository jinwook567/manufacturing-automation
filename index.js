// const path = require("path");
const runApplescript = require("run-applescript");
const path = require("path");
const jsxPath = path.resolve("./createAi.jsx");
const download = require("download");
const fs = require("fs");
const getToday = require("./utils").getToday;
const createAndUploadFile = require("./googleDrive");
const { getTransaction } = require("./db");

async function hello() {
  //fileName
  const buyerName = "이진욱";
  const product = "스마트톡";
  const quantity = "2개";

  const fileName = `${buyerName}_${product}_${quantity}`;
  //앞면, 뒷면

  const imageUrl = "https://we2d-app.s3.ap-northeast-2.amazonaws.com/designedImg/1600801154373.png";
  const imageFileName = imageUrl.split("/").pop();
  const imageFolderPath = `${path.dirname(require.main.filename)}/download`;

  await download(imageUrl, imageFolderPath);
  //download image
  const imageFilePath = `${imageFolderPath}/${imageFileName}`;

  const today = getToday();

  const todayDir = `${path.dirname(require.main.filename)}/result/${today}`;
  if (!fs.existsSync(todayDir)) {
    fs.mkdirSync(todayDir);
  }

  const factoryDir = `${todayDir}/buytech`;
  if (!fs.existsSync(factoryDir)) {
    fs.mkdirSync(factoryDir);
  }

  const folderPath = await runApplescript(
    `tell application "Adobe Illustrator" to do javascript "#include ${jsxPath}" with arguments {"${path.dirname(
      require.main.filename
    )}", "${fileName}", "${today}", "${imageFilePath}"}`
  );
  //data를 효율적으로 전달할 방안이 있는지 탐구.

  // createAndUploadFile(folderPath);
}

async function makeFiles() {
  const transactions = await Promise.resolve(getTransaction());

  const imageAndAiPaths = await Promise.all(
    transactions.map(async (transaction) => {
      const fileNames = await Promise.all(
        Object.entries(transaction.product.image).map(async (data) => {
          const stageName = data[0];
          const imageUrl = data[1];
          const imageFileName = imageUrl.split("/").pop();

          const currentPath = `${path.dirname(require.main.filename)}`;
          const imageFolderPath = `${currentPath}/download`;

          await download(imageUrl, imageFolderPath);
          //download image

          const today = getToday();

          const todayDir = `${currentPath}/result/${today}`;
          if (!fs.existsSync(todayDir)) {
            fs.mkdirSync(todayDir);
          }

          const factoryDir = `${todayDir}/buytech`;
          if (!fs.existsSync(factoryDir)) {
            fs.mkdirSync(factoryDir);
          }

          const aiFileName = `${factoryDir}/${transaction.recipientInfo.reciever}_${transaction.product.category}_${transaction.count}`;
          // const aiFileName = `${transaction.recipientInfo.reciever}_${transaction.product.category}_${transaction.count}`;
          //fileName Maker...

          const imageFilePath = `${imageFolderPath}/${imageFileName}`;
          return {
            imagePath: imageFilePath,
            aiFileName,
          };
        })
      );
      return fileNames[0];
    })
  );

  for (let i = 0; i < imageAndAiPaths.length; i++) {
    let folderPath = await runApplescript(
      `tell application "Adobe Illustrator" to do javascript "#include ${jsxPath}" with arguments {"${path.dirname(
        require.main.filename
      )}", "${imageAndAiPaths[i].aiFileName}_${i}번째", "${imageAndAiPaths[i].imagePath}"}`
    );
  }

  console.log("complete!");
  console.log(factoryDir);

  //apple Script는 map으로 돌아가지 않는다...
  //for문으로 돌려줄 것

  // const folerPaths = await Promise.all(
  //   imageAndAiPaths.map(async (imageAI) => {
  //     const folderPath = await runApplescript(
  //       `tell application "Adobe Illustrator" to do javascript "#include ${jsxPath}" with arguments {"${path.dirname(
  //         require.main.filename
  //       )}", "${imageAI.aiFileName}", "${imageAI.imagePath}"}`
  //     );
  //     return folderPath;
  //   })
  // );
}

makeFiles();

// 1. image download
// 2. image Path

// ai 파일 만드는 쪽은 ai 파일만 만든다.
// excel 만드는 쪽은 엑셀만 만든다.
// 다만 파일명을 공유해야한다.

//hello();
