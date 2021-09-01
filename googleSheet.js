const { google } = require("googleapis");
const runApplescript = require("run-applescript");
const creds = require("./gooledrive-321705-9b1f9f2f2dab.json");
const { getToday, downloadImage, makeFactoryFolder, phoneFomatter } = require("./utils");
const { getTransaction } = require("./db");
const _ = require("lodash");
const path = require("path");
const jsxPath = path.resolve("./createOrderFile.jsx");

const KEYFILEPATH = "/Users/jinwook/Desktop/illustrator/gooledrive-321705-9b1f9f2f2dab.json";
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const sheetService = google.sheets({ version: "v4", auth });
const driveService = google.drive({ version: "v3", auth });

async function createGoogleSheet(googleSheetData) {
  const today = getToday();

  const ID_OF_THE_FOLDER = googleSheetData.id;

  const getResponse = await driveService.files.list({
    q: `'${ID_OF_THE_FOLDER}' in parents and trashed=false`,
  });

  const existFile = getResponse.data.files.find((file) => file.name === `${today}`);

  let sheetId;

  if (!existFile) {
    let sheetMetaData = {
      name: `${today}`,
      parents: [ID_OF_THE_FOLDER],
      mimeType: "application/vnd.google-apps.spreadsheet",
    };

    let response = await driveService.files.create({
      resource: sheetMetaData,
      fields: "id",
    });
    sheetId = response.data.id;
    await sheetService.spreadsheets.values.append({
      spreadsheetId: sheetId,
      // range: "Sheet1",
      range: "Sheet1!A:F",
      valueInputOption: "RAW",
      resource: {
        values: [["이름", "주소", "번호", "배송 메시지", "파일명", "수량"]],
      },
    });
    //make Sheeet File
  } else {
    sheetId = existFile.id;
  }

  //update Sheet
  await sheetService.spreadsheets.values.append({
    spreadsheetId: sheetId,
    // range: "Sheet1",
    range: "Sheet1!A:F",
    valueInputOption: "RAW",
    resource: {
      values: [googleSheetData.data],
    },
  });
}
// createGoogleSheet();

async function getFileName(transaction) {
  const getRows = await sheetService.spreadsheets.values.get({
    spreadsheetId: "12655vAKNcRwhc2lE33V2z_zuo3UdVCKwL-NbMRxoYzI",
    range: "Sheet1",
  });
  const productCode = "clothes-shortsleeve-shirts";
  //get product-code from transaction

  //change array to object type
  const rows = getRows.data.values;
  const tableHead = rows[0];
  let objectData = rows.map((data) => {
    return tableHead.reduce((acc, cur, i) => {
      acc[cur] = data[i];
      if (cur === "options" || cur === "print") {
        acc[cur] = data[i] ? data[i].split(",") : null;
      }
      return acc;
    }, {});
  });

  objectData.shift();

  const { options, fileName, print, templateOptions, factory, sheetId, saveOption } =
    objectData.find((program) => program.code === productCode);

  //options 배열 비교

  //check options
  if (transaction.options) {
    const transactionOptions = Object.entries(transaction.options).map((data) => data[0]);
    if (!_.isEqual(options, transactionOptions)) {
      console.error("엑셀 옵션 데이터와 거래 옵션 데이터와 일치하지 않습니다.");
    }
  }

  //check prints
  const transactionPrint = Object.entries(transaction.product.image).map((data) => data[0]);
  if (!print.includes(...transactionPrint)) {
    console.error("엑셀 옵션 프린트 데이터와 거래 프린트 데이터가 일치하지 않습니다.");
  }

  const optionName = options
    ? options.reduce((acc, cur) => {
        acc = acc + "_" + transaction.options[cur];
        return acc;
      }, "")
    : "";

  let result = {
    templateName: templateOptions
      ? `${fileName}_${transaction.options[templateOptions]}`
      : `${fileName}`,
    factory,
    sheetId,
    saveOption,
  };

  if (print) {
    // const aiFileName = Object.entries(transaction.product.image)
    //   .map((data) => data[0])
    //   .map((printArea) => {
    //     let name;
    //     switch (printArea) {
    //       case "front":
    //         name = "앞면";
    //         break;

    //       case "back":
    //         name = "뒷면";
    //         break;

    //       default:
    //         name = printArea;
    //     }
    //     return `${transaction.recipientInfo.reciever}_${fileName}${optionName}_${name}_${transaction.count}개`;
    //   });

    // result.aiFileName = aiFileName;

    const aiFileAndImageName = await Promise.all(
      Object.entries(transaction.product.image).map(async (data) => {
        let name;
        switch (data[0]) {
          case "front":
            name = "앞면";
            break;

          case "back":
            name = "뒷면";
            break;

          default:
            name = printArea;
        }
        const aiFileName = `${transaction.recipientInfo.reciever}_${fileName}${optionName}_${name}_${transaction.count}개`;
        const imageUrl = data[1];
        const imagePath = await Promise.resolve(downloadImage(imageUrl));
        return { aiFileName, imagePath };
      })
    );
    result.aiFileAndImageName = aiFileAndImageName;
  } else {
    const imagePath = await Promise.resolve(downloadImage(transaction.product.image.front));
    result.aiFileAndImageName = {
      aiFileName: `${transaction.recipientInfo.reciever}_${fileName}${optionName}_${transaction.count}개`,
      imagePath,
    };
  }
  return result;
}

//getFileName()

async function hi() {
  const transactions = await Promise.resolve(getTransaction());

  const processedTransactions = await Promise.all(
    transactions.map(async (transaction) => {
      const fileName = await Promise.resolve(getFileName(transaction));
      const transactionData = transaction.toJSON();
      return { ...transactionData, ...fileName };
      // return fileName;
    })
  );

  const googleSheetData = processedTransactions.map((transaction) => {
    const reciever = transaction.recipientInfo.reciever;
    const address =
      transaction.recipientInfo.address + " " + transaction.recipientInfo.detailAddress;
    const phone = phoneFomatter(transaction.recipientInfo.phone);
    //hello
    const deliveryMessage = transaction.recipientInfo.request || "";
    const fileNames = transaction.aiFileAndImageName.reduce((acc, fileName, i) => {
      if (transaction.aiFileAndImageName.length === i + 1) {
        acc = acc + fileName.aiFileName;
      } else {
        acc = acc + fileName.aiFileName + "\n";
      }

      return acc;
    }, "");
    const count = transaction.count;
    return {
      id: transaction.sheetId,
      data: [reciever, address, phone, deliveryMessage, fileNames, count],
    };
  });

  // for (let i in googleSheetData) {
  //   await createGoogleSheet(googleSheetData[i]);
  // }
  //for문으로 하지 않으면, 엑셀을 만들어놓은 데이터를 찾지못한다.

  //make GoogleSheet Data

  const aiFileDataIllustrator = processedTransactions.reduce((acc, data) => {
    const result = data.aiFileAndImageName.map((fileName) => {
      const factoryDir = makeFactoryFolder(data.factory);
      return {
        ..._.pick(data, ["templateName", "factory", "saveOption"]),
        aiFileName: fileName.aiFileName,
        imagePath: fileName.imagePath,
        factoryDir,
      };
    });
    acc.push(...result);
    return acc;
  }, []);

  for (let i in aiFileDataIllustrator) {
    const data = aiFileDataIllustrator[i];
    const templateFile = `${path.dirname(require.main.filename)}/template/${data.factory}/${
      data.templateName
    }.ai`;
    const newFilePath = `${data.factoryDir}/${data.aiFileName}`;
    const saveOption = data.saveOption;
    const imagePath = data.imagePath;

    await runApplescript(
      `tell application "Adobe Illustrator" to do javascript "#include ${jsxPath}" with arguments {"${templateFile}", "${newFilePath}", "${imagePath}", "${saveOption}"}`
    );
  }

  //for문 돌리기..
}

hi();
