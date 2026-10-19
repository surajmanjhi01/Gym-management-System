const Charge = require('../../models/Charge');
const Payment = require('../../models/Payment');
const Receipt = require('../../models/Receipt');
const Counter = require('../../models/Counter');
const Gym = require('../../models/Gym');
const Member = require('../../models/Member');
const { createChargeSchema, recordPaymentSchema } = require('./payments.validation');

// 1. Manually add an invoice/charge for a member
exports.createCharge = async (req, res, next) => {
  try {
    const data = createChargeSchema.parse(req.body);
    const discount = data.discountPaise || 0;
    const finalAmount = Math.max(0, data.baseAmountPaise - discount);

    const charge = await Charge.create({
      tenantId: req.tenantId,
      memberId: data.memberId,
      membershipId: data.membershipId || null,
      title: data.title,
      type: data.type || 'membership_fee',
      baseAmountPaise: data.baseAmountPaise,
      discountPaise: discount,
      finalAmountPaise: finalAmount,
      dueDate: data.dueDate ? new Date(data.dueDate) : new Date(),
      createdBy: req.user.userId,
    });

    return res.status(201).json({ success: true, data: charge });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};

// 2. Record Payment & Auto-Settle Dues via FIFO
exports.recordPayment = async (req, res, next) => {
  try {
    const { memberId, amountPaise, method, transactionRef, notes, chargeId } = recordPaymentSchema.parse(req.body);

    const [gym, member] = await Promise.all([
      Gym.findById(req.tenantId).lean(),
      Member.findOne({ _id: memberId, tenantId: req.tenantId }).lean(),
    ]);

    if (!member) {
      return res.status(404).json({ success: false, error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found' } });
    }

    // A. Record Payment
    const payment = await Payment.create({
      tenantId: req.tenantId,
      memberId,
      amountPaise,
      currency: 'INR',
      method,
      transactionRef,
      notes,
      recordedBy: req.user.userId,
    });

    // B. Auto-settle charges
    let remainingToAllocate = amountPaise;
    const chargeQuery = {
      tenantId: req.tenantId,
      memberId,
      status: { $in: ['unpaid', 'partially_paid'] },
    };
    if (chargeId) chargeQuery._id = chargeId;

    const unpaidCharges = await Charge.find(chargeQuery).sort({ dueDate: 1 });

    for (const charge of unpaidCharges) {
      if (remainingToAllocate <= 0) break;

      const outstanding = charge.finalAmountPaise - charge.paidAmountPaise;
      const paymentShare = Math.min(remainingToAllocate, outstanding);

      charge.paidAmountPaise += paymentShare;
      remainingToAllocate -= paymentShare;

      charge.status = charge.paidAmountPaise >= charge.finalAmountPaise ? 'paid' : 'partially_paid';
      await charge.save();
    }

    // C. Generate tenant-scoped receipt number
    const seq = await Counter.getNextSequence(req.tenantId, 'receiptNumber');
    const receiptNumber = `REC-${String(seq).padStart(5, '0')}`;

    // D. Create snapshot receipt
    const receipt = await Receipt.create({
      tenantId: req.tenantId,
      receiptNumber,
      paymentId: payment._id,
      memberId,
      amountPaise,
      currency: 'INR',
      paymentMethod: method,
      gymSnapshot: {
        name: gym.name,
        phone: gym.contact.phone,
        email: gym.contact.email,
      },
      memberSnapshot: {
        fullName: member.fullName,
        phone: member.phone,
        memberCode: member.memberCode,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Payment recorded and receipt generated',
      data: { payment, receipt },
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};

// 3. View Member Financial Ledger & Dues
exports.getMemberLedger = async (req, res, next) => {
  try {
    const { memberId } = req.params;

    const [charges, payments] = await Promise.all([
      Charge.find({ tenantId: req.tenantId, memberId }).sort({ createdAt: -1 }).lean(),
      Payment.find({ tenantId: req.tenantId, memberId }).sort({ receivedAt: -1 }).lean(),
    ]);

    const totalCharged = charges.reduce((acc, c) => acc + (c.status !== 'void' ? c.finalAmountPaise : 0), 0);
    const totalPaid = payments.reduce((acc, p) => acc + p.amountPaise, 0);
    const outstandingDues = Math.max(0, totalCharged - totalPaid);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalChargedPaise: totalCharged,
          totalPaidPaise: totalPaid,
          outstandingDuesPaise: outstandingDues,
          totalChargedRupees: totalCharged / 100,
          totalPaidRupees: totalPaid / 100,
          outstandingDuesRupees: outstandingDues / 100,
        },
        charges,
        payments,
      },
    });
  } catch (err) {
    next(err);
  }
};

// 4. Retrieve Single Receipt
exports.getReceipt = async (req, res, next) => {
  try {
    const receipt = await Receipt.findOne({
      _id: req.params.receiptId,
      tenantId: req.tenantId,
    }).lean();

    if (!receipt) {
      return res.status(404).json({ success: false, error: { code: 'RECEIPT_NOT_FOUND', message: 'Receipt not found' } });
    }

    return res.status(200).json({ success: true, data: receipt });
  } catch (err) {
    next(err);
  }
};
// Quick-settle an open charge directly from dashboard / desk view
exports.quickSettleCharge = async (req, res, next) => {
  try {
    const { chargeId } = req.params;
    const { method = 'cash', notes = 'Manual counter settlement' } = req.body;

    // 1. Fetch charge scoped to current tenant
    const charge = await Charge.findOne({
      _id: chargeId,
      tenantId: req.tenantId,
      status: { $in: ['unpaid', 'partially_paid'] },
    });

    if (!charge) {
      return res.status(404).json({
        success: false,
        error: { code: 'CHARGE_NOT_FOUND_OR_PAID', message: 'Charge already cleared or does not exist' },
      });
    }

    // Calculate exact remaining balance
    const remainingPaise = charge.finalAmountPaise - charge.paidAmountPaise;

    const [gym, member] = await Promise.all([
      Gym.findById(req.tenantId).lean(),
      Member.findOne({ _id: charge.memberId, tenantId: req.tenantId }).lean(),
    ]);

    // 2. Create the offsetting payment entry in the ledger
    const payment = await Payment.create({
      tenantId: req.tenantId,
      memberId: charge.memberId,
      amountPaise: remainingPaise,
      currency: 'INR',
      method,
      transactionRef: 'COUNTER-SETTLED',
      notes,
      recordedBy: req.user.userId,
    });

    // 3. Mark charge fully paid
    charge.paidAmountPaise = charge.finalAmountPaise;
    charge.status = 'paid';
    await charge.save();

    // 4. Generate instant receipt
    const seq = await Counter.getNextSequence(req.tenantId, 'receiptNumber');
    const receiptNumber = `REC-${String(seq).padStart(5, '0')}`;

    const receipt = await Receipt.create({
      tenantId: req.tenantId,
      receiptNumber,
      paymentId: payment._id,
      memberId: charge.memberId,
      amountPaise: remainingPaise,
      currency: 'INR',
      paymentMethod: method,
      gymSnapshot: {
        name: gym.name,
        phone: gym.contact.phone,
        email: gym.contact.email,
      },
      memberSnapshot: {
        fullName: member.fullName,
        phone: member.phone,
        memberCode: member.memberCode,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Charge marked as paid. Receipt ${receiptNumber} generated.`,
      data: { charge, payment, receipt },
    });
  } catch (err) {
    next(err);
  }
};