const Transaction = require("./Transaction");
const mongoose = require("mongoose");

async function getTransaction() {
  const db =
    "mongodb+srv://kyu_young:WaByPiHh7Wtmk5we@we2d.tsqtt.mongodb.net/we2d?retryWrites=true&w=majority";
  mongoose
    .connect(db, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
    })
    .then(() => {
      console.log("Connected");
    });

  const transactions = await Transaction.find({ status: "paid" })
    .sort({ createdAt: -1 })
    .select("-iamPortData");

  return transactions;
}

module.exports = { getTransaction };
