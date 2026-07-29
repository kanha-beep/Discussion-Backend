import { ExpressError } from "../Middlewares/ExpressError.js";
import { Mail } from "../Models/Mail.Model.js";
import { User } from "../Models/User.Models.js";

const mailPreview = (mailDoc, currentUserId) => ({
  _id: mailDoc._id,
  subject: mailDoc.subject,
  body: mailDoc.body,
  sender: {
    _id: mailDoc.sender?._id || mailDoc.sender,
    email: mailDoc.sender?.email || mailDoc.senderEmail,
    name:
      [mailDoc.sender?.firstName, mailDoc.sender?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || mailDoc.sender?.email?.split("@")[0] || mailDoc.senderEmail,
  },
  recipient: {
    _id: mailDoc.recipient?._id || mailDoc.recipient,
    email: mailDoc.recipient?.email || mailDoc.recipientEmail,
    name:
      [mailDoc.recipient?.firstName, mailDoc.recipient?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      mailDoc.recipient?.email?.split("@")[0] ||
      mailDoc.recipientEmail,
  },
  senderEmail: mailDoc.senderEmail,
  recipientEmail: mailDoc.recipientEmail,
  readByRecipient: !!mailDoc.readByRecipient,
  createdAt: mailDoc.createdAt,
  updatedAt: mailDoc.updatedAt,
  folder:
    String(mailDoc.sender?._id || mailDoc.sender) === String(currentUserId)
      ? "sent"
      : "inbox",
});

export const getMailbox = async (req, res) => {
  const currentUserId = req.user._id;

  const [inboxDocs, sentDocs] = await Promise.all([
    Mail.find({ recipient: currentUserId })
      .populate("sender", "firstName lastName email")
      .populate("recipient", "firstName lastName email")
      .sort({ createdAt: -1 }),
    Mail.find({ sender: currentUserId })
      .populate("sender", "firstName lastName email")
      .populate("recipient", "firstName lastName email")
      .sort({ createdAt: -1 }),
  ]);

  res.json({
    inbox: inboxDocs.map((mail) => mailPreview(mail, currentUserId)),
    sent: sentDocs.map((mail) => mailPreview(mail, currentUserId)),
  });
};

export const sendMail = async (req, res, next) => {
  const currentUser = await User.findById(req.user._id);
  if (!currentUser) {
    return next(new ExpressError(404, "User not found"));
  }

  const toEmail = (req.body?.toEmail || "").trim().toLowerCase();
  console.log("sender email: ", toEmail)
  const subject = (req.body?.subject || "").trim();
  const body = (req.body?.body || "").trim();

  if (!toEmail || !subject || !body) {
    return next(new ExpressError(400, "To, subject, and message are required"));
  }

  if (toEmail === String(currentUser.email || "").trim().toLowerCase()) {
    return next(new ExpressError(400, "You cannot send mail to yourself"));
  }

  const recipient = await User.findOne({ email: toEmail });
  console.log("recepient: ", recipient)
  if (!recipient) {
    return next(new ExpressError(404, "Recipient email not found"));
  }

  const mail = await Mail.create({
    sender: currentUser._id,
    recipient: recipient._id,
    senderEmail: currentUser.email,
    recipientEmail: recipient.email,
    subject,
    body,
  });

  const populatedMail = await Mail.findById(mail._id)
    .populate("sender", "firstName lastName email")
    .populate("recipient", "firstName lastName email");

  res.status(201).json({
    message: "Mail sent successfully",
    mail: mailPreview(populatedMail, currentUser._id),
  });
};

export const markMailAsRead = async (req, res, next) => {
  const mail = await Mail.findById(req.params.mailId);
  if (!mail) {
    return next(new ExpressError(404, "Mail not found"));
  }

  if (String(mail.recipient) !== String(req.user._id)) {
    return next(new ExpressError(403, "Only the recipient can mark mail as read"));
  }

  mail.readByRecipient = true;
  await mail.save();

  res.json({ message: "Mail marked as read" });
};
