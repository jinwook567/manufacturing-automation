const { model, Schema, Model } = require("mongoose");

const transactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    designerId: {
      type: Schema.Types.ObjectId,
      ref: "Designer",
      required: true,
    },
    commonId: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
    },
    profit: {
      type: Number,
      required: true,
    },
    product: {
      type: Object,
      required: true,
    },
    customerInfo: {
      type: Object,
      required: true,
    },
    token: {
      type: String,
    },
    recipientInfo: {
      type: Object,
      required: true,
    },
    deliveryInfo: {
      type: Object,
    },
    settlement: {
      type: Date,
    },
    options: {
      type: Object,
    },
    count: {
      type: Number,
      required: true,
    },
    iamPortData: {
      type: Object,
    },
    status: {
      type: String,
      default: "start",
    },
    point: {
      type: Number,
    },
    mine: {
      type: Boolean,
    },
    cartId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Transaction = model("Transaction", transactionSchema);

module.exports = Transaction;
