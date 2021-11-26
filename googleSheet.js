const { google } = require("googleapis");
const runApplescript = require("run-applescript");
const creds = require("./gooledrive-321705-9b1f9f2f2dab.json");
const { v4: uuidv4 } = require("uuid");

const {
  getToday,
  downloadImage,
  makeLocalTodayDir,
  phoneFomatter,
  getPrintAreaName,
} = require("./utils");
const { getTransaction } = require("./db");
const _ = require("lodash");
const path = require("path");
const jsxPath = path.resolve("./createOrderFile.jsx");

const KEYFILEPATH = path.resolve("./gooledrive-321705-9b1f9f2f2dab.json");
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

async function getProdcutNameMakingExcel() {
  const rowsData = await sheetService.spreadsheets.values.get({
    spreadsheetId: "12655vAKNcRwhc2lE33V2z_zuo3UdVCKwL-NbMRxoYzI",
    //excel id, 해당 값은 고정임.
    range: "Sheet1",
  });

  const rows = rowsData.data.values;
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
  console.log("상품 만들기 구글 엑셀 정보 수신완료");
  return objectData;
}

async function getIllustratorFileName({ transaction, excelData }) {
  let result;
  const productCode = transaction.productId.code;

  const { options, fileName, print, templateOptions, factory, folderId, saveOption } =
    excelData.find((data) => data.code === productCode);

  //check options
  if (transaction.options) {
    const transactionOptions = Object.entries(transaction.options).map((data) => data[0]);
    //옵션 객체 필드명만 배열로 묶음.
    if (!_.isEqual(options, transactionOptions)) {
      console.error("엑셀 옵션 데이터와 거래 옵션 데이터와 일치하지 않습니다.");
      return;
    }
  }

  //check prints
  const transactionPrint = Object.entries(transaction.product.image).map((data) => data[0]);
  if (print) {
    if (!print.includes(...transactionPrint)) {
      //프린트는 여러면이 있으므로 일치가 아니라 포함이 되도록해야함.
      console.error("엑셀 옵션 프린트 데이터와 거래 프린트 데이터가 일치하지 않습니다.");
      console.error("에러 거래:" + transaction);
      return;
    }
  } else {
    if (!_.isEqual(transactionPrint, ["front"])) {
      console.error("엑셀 옵션 프린트 데이터와 거래 프린트 데이터가 일치하지 않습니다.");
      console.error("에러 거래:" + transaction);
      return;
    }
  }

  result = {
    templateName: templateOptions
      ? `${fileName}_${transaction.options[templateOptions]}`
      : `${fileName}`,
    //templateOptions는 어떠한 옵션이 템플릿을 구분하는가를 알기위해서 그렇다.
    //컬러같은 경우에는 크기가 동일하기 때문에 굳이 템플릿이 바뀔 필요가 없다.
    factory,
    folderId,
    saveOption,
  };

  const optionName = options
    ? options.reduce((acc, cur) => {
        acc = acc + "_" + transaction.options[cur];
        return acc;
      }, "")
    : "";

  const imagePathAndAiName = await Promise.all(
    Object.entries(transaction.product.image).map(async (data) => {
      const imageUrl = data[1];
      const imagePath = await Promise.resolve(downloadImage(imageUrl));

      const printAreaName = getPrintAreaName(data[0]);
      //data[0] printArea 영문 필드명 한글로 변환

      const aiFileName = print
        ? `${transaction.recipientInfo.reciever}_${fileName}${optionName}_${printAreaName}_${transaction.count}개`
        : `${transaction.recipientInfo.reciever}_${fileName}${optionName}_${transaction.count}개`;

      return { imagePath, aiFileName };
    })
  );

  result.imagePath_aiFileNames = imagePathAndAiName;
  console.log("이미지 다운 및 일러스트 파일명 제작 완료");

  return result;
}

async function insertSheetData(trans_ill_drive, combinedSheetId) {
  const today = getToday();
  //make insert data
  const combined_deliveryId = uuidv4();
  for (let i in trans_ill_drive) {
    const transaction = trans_ill_drive[i];

    const transactionId = transaction._id;

    let deliveryId;
    let reciever;
    let address;
    let phone;
    let deliveryMessage;
    let sheetRange;

    deliveryId = transaction.commonId ? transaction.commonId : transaction._id;
    reciever = transaction.recipientInfo.reciever;
    address = transaction.recipientInfo.address + " " + transaction.recipientInfo.detailAddress;
    phone = phoneFomatter(transaction.recipientInfo.phone);
    deliveryMessage = transaction.recipientInfo.request || "";
    sheetRange = "Sheet1";

    // 아래 코드는 합배송 시스템이 구축되면 실행

    // if (transaction.combined) {
    //   deliveryId = combined_deliveryId;
    //   reciever = "주식회사 위투디";
    //   address = "서울특별시 노원구 화랑로 465 (엘네스트빌 오피스텔) 201호";
    //   phone = "010-8475-3257";
    //   deliveryMessage = transaction.combinedNumber;
    //   sheetRange = "합배송";
    // } else {
    //   deliveryId = transaction.commonId ? transaction.commonId : transaction._id;
    //   reciever = transaction.recipientInfo.reciever;
    //   address = transaction.recipientInfo.address + " " + transaction.recipientInfo.detailAddress;
    //   phone = phoneFomatter(transaction.recipientInfo.phone);
    //   deliveryMessage = transaction.recipientInfo.request || "";
    //   sheetRange = "Sheet1";
    // }

    const fileNames = transaction.illustrator.imagePath_aiFileNames.reduce((acc, fileName, i) => {
      if (transaction.illustrator.imagePath_aiFileNames.length === i + 1) {
        acc = acc + fileName.aiFileName;
        //마지막은 띄어쓰기 X
      } else {
        acc = acc + fileName.aiFileName + "\n";
      }
      return acc;
    }, "");
    const count = transaction.count;

    const sheetData = [
      transactionId,
      deliveryId,
      reciever,
      address,
      phone,
      deliveryMessage,
      fileNames,
      count,
    ];

    await sheetService.spreadsheets.values.append({
      spreadsheetId: transaction.illustrator.todayFolder_OrderSheet_Id,
      // range: "Sheet1",
      range: `${sheetRange}!A:H`,
      valueInputOption: "RAW",
      resource: {
        values: [sheetData],
      },
    });

    await sheetService.spreadsheets.values.append({
      spreadsheetId: transaction.illustrator.thisMonthExcelId,
      range: "Sheet1!A:I",
      valueInputOption: "RAW",
      resource: {
        values: [[...sheetData, today]],
      },
    });

    if (transaction.combined) {
      await sheetService.spreadsheets.values.append({
        spreadsheetId: combinedSheetId,
        range: "Sheet1!A:I",
        valueInputOption: "RAW",
        resource: {
          values: [sheetData],
        },
      });
    }
  }

  console.log("엑셀 데이터 삽입 완료");
}

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
      const factoryDir = makeLocalTodayDir(data.factory);
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

//hi();

module.exports = {
  getProdcutNameMakingExcel,
  getIllustratorFileName,
  insertSheetData,
};

//update Sheet
// await sheetService.spreadsheets.values.append({
//   spreadsheetId: sheetId,
//   // range: "Sheet1",
//   range: "Sheet1!A:F",
//   valueInputOption: "RAW",
//   resource: {
//     values: [googleSheetData.data],
//   },
// });
