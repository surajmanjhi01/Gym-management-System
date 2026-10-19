const Enquiry = require('../../models/Enquiry');
const Member = require('../../models/Member');
const Membership = require('../../models/Membership');
const MembershipPlan = require('../../models/MembershipPlan');
const Charge = require('../../models/Charge');
const Payment = require('../../models/Payment');
const Receipt = require('../../models/Receipt');
const Counter = require('../../models/Counter');
const Gym = require('../../models/Gym');
const { calculateMembershipDates } = require('../../shared/dates/expiryCalculator');
const {
  createEnquirySchema,
  addFollowUpSchema,
  convertProspectSchema,
} = require('./enquiries.validation');

// 1. Create a Walk-in or Lead Enquiry
exports.createEnquiry = async (req, res, next) => {
  try {
    const data = createEnquirySchema.parse(req.body);

    const enquiry = await Enquiry.create({
      ...data,
      tenantId: req.tenantId,
      createdBy: req.user.userId,
      status: data.nextFollowUpDate ? 'follow_up_scheduled' : 'new',
    });

    return res.status(201).json({ success: true, data: enquiry });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};

// 2. Get Paginated Enquiries with Queue Filters
exports.getEnquiries = async (req, res, next) => {
  try {
    const { status, queue, search, page = 1, limit = 20 } = req.query;
    const filter = { tenantId: req.tenantId };

    if (status && status !== 'all') {
      filter.status = status;
    }

    // Queue filter: show overdue follow-ups or today's scheduled calls
    if (queue === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      filter.nextFollowUpDate = { $gte: todayStart,$lte: todayEnd };
      filter.status = { $nin: ['converted', 'lost'] };
    } else if (queue === 'overdue') {
      filter.nextFollowUpDate = { $lt: new Date() };
      filter.status = { $nin: ['converted', 'lost'] };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [{ fullName: searchRegex }, { phone: searchRegex }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [enquiries, total] = await Promise.all([
      Enquiry.find(filter)
        .populate('assignedStaff', 'name email')
        .populate('interestedPlanId', 'name pricePaise duration')
        .sort({ nextFollowUpDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Enquiry.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: enquiries,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// 3. Log Follow-Up Call / Message Interaction
exports.logFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes, outcome, nextFollowUpDate, trialDate, status } = addFollowUpSchema.parse(req.body);

    const enquiry = await Enquiry.findOne({ _id: id, tenantId: req.tenantId });
    if (!enquiry) {
      return res.status(404).json({ success: false, error: { code: 'ENQUIRY_NOT_FOUND', message: 'Enquiry record not found' } });
    }

    enquiry.followUps.push({
      scheduledAt: enquiry.nextFollowUpDate || new Date(),
      contactedAt: new Date(),
      notes,
      outcome,
      handledBy: req.user.userId,
    });

    if (nextFollowUpDate !== undefined) enquiry.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null;
    if (trialDate !== undefined) enquiry.trialDate = trialDate ? new Date(trialDate) : null;
    if (status) enquiry.status = status;
    else if (outcome === 'not_interested') enquiry.status = 'lost';
    else if (outcome === 'trial_booked') enquiry.status = 'trial_active';
    else if (nextFollowUpDate) enquiry.status = 'follow_up_scheduled';

    await enquiry.save();
    return res.status(200).json({ success: true, message: 'Follow-up logged', data: enquiry });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};

// 4. Convert Prospect to Active Member (Seamless Enrollment)
exports.convertToMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { planId, startDate, discountPaise = 0, paidAmountPaise = 0, paymentMethod } =
      convertProspectSchema.parse(req.body);

    const [enquiry, plan, gym] = await Promise.all([
      Enquiry.findOne({ _id: id, tenantId: req.tenantId }),
      MembershipPlan.findOne({ _id: planId, tenantId: req.tenantId, isActive: true }),
      Gym.findById(req.tenantId).lean(),
    ]);

    if (!enquiry) {
      return res.status(404).json({ success: false, error: { code: 'ENQUIRY_NOT_FOUND', message: 'Prospect not found' } });
    }
    if (enquiry.status === 'converted') {
      return res.status(409).json({ success: false, error: { code: 'ALREADY_CONVERTED', message: 'Prospect is already converted' } });
    }
    if (!plan) {
      return res.status(404).json({ success: false, error: { code: 'PLAN_NOT_FOUND', message: 'Selected plan is not available' } });
    }

    // Step A: Create Member profile using prospect's contact info
    const nextSeq = await Counter.getNextSequence(req.tenantId, 'memberCode');
    const memberCode = `MEM-${String(nextSeq).padStart(4, '0')}`;

    const member = await Member.create({
      tenantId: req.tenantId,
      memberCode,
      fullName: enquiry.fullName,
      phone: enquiry.phone,
      email: enquiry.email,
      gender: enquiry.gender,
      joinedAt: startDate ? new Date(startDate) : new Date(),
      status: 'active',
      notes: enquiry.notes,
      createdBy: req.user.userId,
    });

    // Step B: Calculate dates & create Membership
    const effectiveStart = startDate ? new Date(startDate) : new Date();
    const { startDate: calculatedStart, endDate: calculatedEnd } = calculateMembershipDates(
      effectiveStart,
      plan.duration.value,
      plan.duration.unit
    );

    const membership = await Membership.create({
      tenantId: req.tenantId,
      memberId: member._id,
      planId: plan._id,
      planSnapshot: {
        name: plan.name,
        duration: plan.duration,
        pricePaise: plan.pricePaise,
      },
      startDate: calculatedStart,
      endDate: calculatedEnd,
      status: 'active',
      assignedBy: req.user.userId,
    });

    // Step C: Create Charge Invoice
    const finalFee = Math.max(0, plan.pricePaise - discountPaise);
    const charge = await Charge.create({
      tenantId: req.tenantId,
      memberId: member._id,
      membershipId: membership._id,
      title: `${plan.name} Membership Fee`,
      type: 'membership_fee',
      currency: 'INR',
      baseAmountPaise: plan.pricePaise,
      discountPaise,
      finalAmountPaise: finalFee,
      paidAmountPaise: 0,
      dueDate: calculatedStart,
      status: finalFee === 0 ? 'paid' : 'unpaid',
      createdBy: req.user.userId,
    });

    // Step D: Process upfront payment if made at the time of conversion
    let payment = null;
    let receipt = null;

    if (paidAmountPaise > 0) {
      payment = await Payment.create({
        tenantId: req.tenantId,
        memberId: member._id,
        amountPaise: paidAmountPaise,
        currency: 'INR',
        method: paymentMethod,
        transactionRef: 'CONVERSION-PAYMENT',
        notes: `Initial payment during conversion from enquiry`,
        recordedBy: req.user.userId,
      });

      const actualSettled = Math.min(paidAmountPaise, charge.finalAmountPaise);
      charge.paidAmountPaise = actualSettled;
      charge.status = charge.paidAmountPaise >= charge.finalAmountPaise ? 'paid' : 'partially_paid';
      await charge.save();

      const receiptSeq = await Counter.getNextSequence(req.tenantId, 'receiptNumber');
      const receiptNumber = `REC-${String(receiptSeq).padStart(5, '0')}`;

      receipt = await Receipt.create({
        tenantId: req.tenantId,
        receiptNumber,
        paymentId: payment._id,
        memberId: member._id,
        amountPaise: paidAmountPaise,
        currency: 'INR',
        paymentMethod,
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
    }

    // Step E: Update Prospect to converted status
    enquiry.status = 'converted';
    enquiry.convertedMemberId = member._id;
    enquiry.conversionDate = new Date();
    await enquiry.save();

    return res.status(200).json({
      success: true,
      message: `${enquiry.fullName} successfully converted to member ${member.memberCode}`,
      data: {
        member,
        membership,
        charge,
        payment,
        receipt,
      },
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};