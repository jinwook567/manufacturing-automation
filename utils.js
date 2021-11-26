const path = require("path");
const download = require("download");
const fs = require("fs");

function getToday() {
  const date = new Date();

  const today = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  return today;
}

async function downloadImage(imageUrl) {
  const imageFileName = imageUrl.split("/").pop();

  const currentPath = `${path.dirname(require.main.filename)}`;
  const imageFolderPath = `${currentPath}/download`;

  await download(imageUrl, imageFolderPath);
  const imageFilePath = `${imageFolderPath}/${imageFileName}`;
  return imageFilePath;
}

function makeLocalTodayDir(factoryName) {
  const localFolderPath = "/Users/jinwook/Desktop/order_history";
  const today = getToday();

  const date = new Date();
  const month = `${date.getFullYear()}-${date.getMonth() + 1}`;

  const monthDir = `${localFolderPath}/${factoryName}/${month}`;

  if (!fs.existsSync(monthDir)) {
    fs.mkdirSync(monthDir);
  }

  const todayDir = `${monthDir}/${today}`;
  if (!fs.existsSync(todayDir)) {
    fs.mkdirSync(todayDir);
  }
  return todayDir;
}

function phoneFomatter(num, type) {
  var formatNum = "";

  if (num.length == 11) {
    if (type == 0) {
      formatNum = num.replace(/(\d{3})(\d{4})(\d{4})/, "$1-****-$3");
    } else {
      formatNum = num.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    }
  } else if (num.length == 8) {
    formatNum = num.replace(/(\d{4})(\d{4})/, "$1-$2");
  } else {
    if (num.indexOf("02") == 0) {
      if (type == 0) {
        formatNum = num.replace(/(\d{2})(\d{4})(\d{4})/, "$1-****-$3");
      } else {
        formatNum = num.replace(/(\d{2})(\d{4})(\d{4})/, "$1-$2-$3");
      }
    } else {
      if (type == 0) {
        formatNum = num.replace(/(\d{3})(\d{3})(\d{4})/, "$1-***-$3");
      } else {
        formatNum = num.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
      }
    }
  }

  return formatNum;
}

function getPrintAreaName(printArea) {
  let name;
  switch (printArea) {
    case "front":
      name = "앞면";
      break;

    case "back":
      name = "뒷면";
      break;

    default:
      name = printArea;
  }
  return name;
}

module.exports = {
  getToday,
  downloadImage,
  makeLocalTodayDir,
  phoneFomatter,
  getPrintAreaName,
};
