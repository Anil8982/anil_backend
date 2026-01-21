const {
  DOCTOR_APPROVED,
  DOCTOR_REJECTED,
  APPOINTMENT_REQUESTED,
  APPOINTMENT_CONFIRMED,
  APPOINTMENT_REJECTED,
  APPOINTMENT_CANCELLED_BY_PATIENT,
  APPOINTMENT_CANCELLED_BY_ADMIN,
  APPOINTMENT_COMPLETED,
  APPOINTMENT_REMINDER,
  VISIT_SUMMARY_ADDED,
} = require("../events/notification.events");

const messages = require("../utils/notification.messages");
const { createAppNotification } = require("../utils/notification.db");
const {
  isNotificationAlreadySent,
  logNotification,
} = require("../utils/notification.logger");

const emailService = require("../utils/email.service");

const doctorApprovedTemplate = require("../utils/emailTemplates/doctorApproved.template");
const doctorRejectedTemplate = require("../utils/emailTemplates/doctorRejected.template");
const appointmentConfirmedTemplate = require("../utils/emailTemplates/appointmentConfirmed.template");
const appointmentRejectedTemplate = require("../utils/emailTemplates/appointmentRejected.template");
const appointmentReminderTemplate = require("../utils/emailTemplates/appointmentReminder.template");

/* =========================
   COMMON HELPERS
========================= */

async function sendApp({ eventType, userId, role, entityId, title, message }) {
  if (!userId || !role) {
    console.error("sendApp missing userId or role", {
      eventType,
      userId,
      role,
      entityId,
    });
    return;
  }

  const alreadySent = await isNotificationAlreadySent({
    eventType,
    userId,
    entityId,
    channel: "APP",
  });
  if (alreadySent) return;

  await createAppNotification({
    userId,
    role,
    title,
    message,
    appointmentId: entityId ?? null,
  });

  await logNotification({
    eventType,
    userId,
    entityId,
    channel: "APP",
    status: "SUCCESS",
  });
}

async function sendEmail({ eventType, userId, entityId, to, subject, html }) {
  const alreadySent = await isNotificationAlreadySent({
    eventType,
    userId,
    entityId,
    channel: "EMAIL",
  });
  if (alreadySent) return;

  try {
    await emailService.sendEmail({ to, subject, html });
    await logNotification({
      eventType,
      userId,
      entityId,
      channel: "EMAIL",
      status: "SUCCESS",
    });
  } catch (err) {
    await logNotification({
      eventType,
      userId,
      entityId,
      channel: "EMAIL",
      status: "FAILED",
      errorMessage: err.message,
    });
  }
}

/* =========================
   EVENT HANDLERS
========================= */

async function handleAppointmentRequested(payload) {
  const { eventType, doctor, appointmentId } = payload;
  const msg = messages[eventType].doctor;

  await sendApp({
    eventType,
    userId: doctor.id,
    role: "DOCTOR",
    entityId: appointmentId,
    title: msg.title,
    message: msg.message,
  });
}

async function handleAppointmentCancelledByPatient(payload) {
  const { eventType, doctor, patient, appointmentId } = payload;
  const msg = messages[eventType];

  await sendApp({
    eventType,
    userId: doctor.id,
    role: "DOCTOR",
    entityId: appointmentId,
    title: msg.doctor.title,
    message: msg.doctor.message,
  });

  await sendApp({
    eventType,
    userId: patient.id,
    role: "PATIENT",
    entityId: appointmentId,
    title: msg.patient.title,
    message: msg.patient.message,
  });
}

async function handleAppointmentCancelledByAdmin(payload) {
  const { eventType, doctor, patient, appointmentId } = payload;
  const msg = messages[eventType];

  await sendApp({
    eventType,
    userId: doctor.id,
    role: "DOCTOR",
    entityId: appointmentId,
    title: msg.doctor.title,
    message: msg.doctor.message,
  });

  await sendApp({
    eventType,
    userId: patient.id,
    role: "PATIENT",
    entityId: appointmentId,
    title: msg.patient.title,
    message: msg.patient.message,
  });
}

async function handleAppointmentCompleted(payload) {
  const { eventType, patient, appointmentId } = payload;
  const msg = messages[eventType].patient;

  await sendApp({
    eventType,
    userId: patient.id,
    role: "PATIENT",
    entityId: appointmentId,
    title: msg.title,
    message: msg.message,
  });
}

async function handleVisitSummaryAdded(payload) {
  const { eventType, patient, appointmentId } = payload;
  const msg = messages[eventType].patient;

  await sendApp({
    eventType,
    userId: patient.id,
    role: "PATIENT",
    entityId: appointmentId,
    title: msg.title,
    message: msg.message,
  });
}

/* =========================
   EXISTING HANDLERS
========================= */

async function handleDoctorApproved(payload) {
  const { eventType, doctor } = payload;
  const msg = messages[eventType].doctor;

  await sendApp({
    eventType,
    userId: doctor.id,
    role: "DOCTOR",
    entityId: doctor.id,
    title: msg.title,
    message: msg.message,
  });

  await sendEmail({
    eventType,
    userId: doctor.id,
    entityId: doctor.id,
    to: doctor.email,
    subject: msg.title,
    html: doctorApprovedTemplate({ doctorName: doctor.name }),
  });
}

async function handleDoctorRejected(payload) {
  const { eventType, doctor } = payload;
  const msg = messages[eventType].doctor;

  await sendApp({
    eventType,
    userId: doctor.id,
    role: "DOCTOR",
    entityId: doctor.id,
    title: msg.title,
    message: msg.message,
  });

  await sendEmail({
    eventType,
    userId: doctor.id,
    entityId: doctor.id,
    to: doctor.email,
    subject: msg.title,
    html: doctorRejectedTemplate({ doctorName: doctor.name }),
  });
}

async function handleAppointmentConfirmed(payload) {
  const { eventType, patient, doctor, appointmentTime, appointmentId } =
    payload;
  const msg = messages[eventType].patient;

  await sendApp({
    eventType,
    userId: patient.id,
    role: "PATIENT",
    entityId: appointmentId,
    title: msg.title,
    message: msg.message,
  });

  await sendEmail({
    eventType,
    userId: patient.id,
    entityId: appointmentId,
    to: patient.email,
    subject: msg.title,
    html: appointmentConfirmedTemplate({
      patientName: patient.name,
      doctorName: doctor.name,
      appointmentTime,
    }),
  });
}

async function handleAppointmentRejected(payload) {
  const { eventType, patient, doctor, appointmentId } = payload;
  const msg = messages[eventType].patient;

  await sendApp({
    eventType,
    userId: patient.id,
    role: "PATIENT",
    entityId: appointmentId,
    title: msg.title,
    message: msg.message,
  });

  await sendEmail({
    eventType,
    userId: patient.id,
    entityId: appointmentId,
    to: patient.email,
    subject: msg.title,
    html: appointmentRejectedTemplate({
      patientName: patient.name,
      doctorName: doctor.name,
    }),
  });
}

async function handleAppointmentReminder(payload) {
  const { eventType, patient, appointmentId } = payload;
  const msg = messages[eventType].patient;

  await sendApp({
    eventType,
    userId: patient.id,
    role: "PATIENT",
    entityId: appointmentId,
    title: msg.title,
    message: msg.message,
  });

  await sendEmail({
    eventType,
    userId: patient.id,
    entityId: appointmentId,
    to: patient.email,
    subject: msg.title,
    html: appointmentReminderTemplate({
      patientName: patient.name,
    }),
  });
}

module.exports = {
  handleDoctorApproved,
  handleDoctorRejected,
  handleAppointmentRequested,
  handleAppointmentConfirmed,
  handleAppointmentRejected,
  handleAppointmentCancelledByPatient,
  handleAppointmentCancelledByAdmin,
  handleAppointmentCompleted,
  handleAppointmentReminder,
  handleVisitSummaryAdded,
};
  