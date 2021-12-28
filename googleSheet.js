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
  getDeliveryComapnyNameByFactoryName,
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

async function getSheetIdBySpreadSheetId(spreadSheetId) {
  const result = await sheetService.spreadsheets.get({
    spreadsheetId: spreadSheetId,
    includeGridData: false,
  });
  const data = result.data.sheets
    ? result.data.sheets[0].properties
      ? result.data.sheets[0].properties.sheetId
      : undefined
    : undefined;
  return data;
}

async function updateProtectedCell({ spreadSheetId, sheetId, startColumnIndex, endColumnIndex }) {
  await sheetService.spreadsheets.batchUpdate({
    spreadsheetId: spreadSheetId,
    requestBody: {
      requests: [
        {
          addProtectedRange: {
            protectedRange: {
              range: {
                sheetId: sheetId,
                startColumnIndex: startColumnIndex,
                endColumnIndex: endColumnIndex,
              },
              description: "protect",
              warningOnly: false,
              editors: {
                users: [
                  "jinwook567@we2d.com",
                  "products@we2d.com",
                  "googledriveserviceaccount@gooledrive-321705.iam.gserviceaccount.com",
                ],
              },
            },
          },
        },
      ],
    },
  });
}

async function getProdcutNameMakingExcel() {
  const rowsData = await sheetService.spreadsheets.values.get({
    spreadsheetId: "1xpNNUfUNbfYq-ASAyDuAaFcHts8PDKZ3ec3-IfzQD8I",
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

    const deliverySheetData = [
      deliveryId,
      reciever,
      address,
      phone,
      deliveryMessage,
      `${fileNames}`,
      `${getDeliveryComapnyNameByFactoryName(transaction.illustrator.factory)}`,
      "",
    ];
    //마지막 열은 운송장번호, 현재는 값이 없기 때문에 넣어주지 않음.

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
      spreadsheetId: transaction.illustrator.todayFolder_DeliverySheet_Id,
      // range: "Sheet1",
      range: `${sheetRange}!A:H`,
      valueInputOption: "RAW",
      resource: {
        values: [deliverySheetData],
      },
    });

    //batchUpdate 운송장번호 중복제거
    await sheetService.spreadsheets.batchUpdate({
      spreadsheetId: transaction.illustrator.todayFolder_DeliverySheet_Id,
      resource: {
        requests: [
          {
            deleteDuplicates: {
              range: {
                // sheetId: sheetId,
                startRowIndex: 1,
                // endRowIndex: 30,
                // row가 없으면, rows 처음부터 끝까지 전부
                startColumnIndex: 0,
                endColumnIndex: 7,
              },
              comparisonColumns: [
                {
                  dimension: "COLUMNS",
                  startIndex: 0,
                  endIndex: 1,
                },
                //첫 번째 열에 관련된 내용만 비교한다. (배송 id)
                //https://developers.google.com/sheets/api/reference/rest/v4/DimensionRange
              ],
            },
          },
        ],
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

module.exports = {
  getProdcutNameMakingExcel,
  getIllustratorFileName,
  insertSheetData,
  getSheetIdBySpreadSheetId,
  updateProtectedCell,
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
