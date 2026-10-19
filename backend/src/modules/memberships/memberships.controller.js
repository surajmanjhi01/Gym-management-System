const MembershipPlan = require('../../models/MembershipPlan');
const Membership = require('../../models/Membership');
const Member = require('../../models/Member');
const { calculateMembershipDates } = require('../../shared/dates/expiryCalculator');
const {
  createPlanSchema,
  assignMembershipSchema,
  freezeMembershipSchema,
} = require('./memberships.validation');

// --- PLAN CONFIGURATION ---

exports.createPlan = async (req, res, next) => {
  try {
    const data = createPlanSchema.parse(req.body);
    const plan = await MembershipPlan.create({ ...data, tenantId: req.tenantId });
    return res.status(201).json({ success: true, data: plan });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};

exports.getPlans = async (req, res, next) => {
  try {
    const plans = await MembershipPlan.find({ tenantId: req.tenantId, isActive: true }).lean();
    return res.status(200).json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
};

// --- MEMBERSHIP LIFECYCLE ---

// Assign or Renew a plan
exports.assignPlan = async (req, res, next) => {
  try {
    const { memberId, planId, startDate } = assignMembershipSchema.parse(req.body);

    const [member, plan] = await Promise.all([
      Member.findOne({ _id: memberId, tenantId: req.tenantId }),
      MembershipPlan.findOne({ _id: planId, tenantId: req.tenantId, isActive: true }),
    ]);

    if (!member) {
      return res.status(404).json({ success: false, error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found' } });
    }
    if (!plan) {
      return res.status(404).json({ success: false, error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found or inactive' } });
    }

    // Check if member already has an active membership
    const activeMembership = await Membership.findOne({
      tenantId: req.tenantId,
      memberId,
      status: 'active',
    }).sort({ endDate: -1 });

    // Renewal rule: If renewing before current expiry, append after the current endDate
    let effectiveStart = startDate ? new Date(startDate) : new Date();
    if (activeMembership && activeMembership.endDate > new Date()) {
      effectiveStart = new Date(activeMembership.endDate.getTime() + 1000); // 1 sec after previous ends
    }

    const { startDate: calculatedStart, endDate: calculatedEnd } = calculateMembershipDates(
      effectiveStart,
      plan.duration.value,
      plan.duration.unit
    );

    const membership = await Membership.create({
      tenantId: req.tenantId,
      memberId,
      planId,
      planSnapshot: {
        name: plan.name,
        duration: plan.duration,
        pricePaise: plan.pricePaise,
      },
      startDate: calculatedStart,
      endDate: calculatedEnd,
      status: calculatedStart > new Date() ? 'scheduled' : 'active',
      assignedBy: req.user.userId,
    });

    return res.status(201).json({ success: true, data: membership });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};

// Freeze an active membership
exports.freezeMembership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = freezeMembershipSchema.parse(req.body);

    const membership = await Membership.findOne({ _id: id, tenantId: req.tenantId, status: 'active' });
    if (!membership) {
      return res.status(404).json({
        success: false,
        error: { code: 'ACTIVE_MEMBERSHIP_NOT_FOUND', message: 'No active membership eligible to freeze' },
      });
    }

    membership.status = 'frozen';
    membership.freezeHistory.push({
      startDate: new Date(),
      reason: reason || 'Member requested freeze',
      frozenBy: req.user.userId,
    });

    await membership.save();
    return res.status(200).json({ success: true, message: 'Membership frozen', data: membership });
  } catch (err) {
    next(err);
  }
};

// Unfreeze and automatically push out the endDate by the frozen duration
exports.unfreezeMembership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const membership = await Membership.findOne({ _id: id, tenantId: req.tenantId, status: 'frozen' });

    if (!membership) {
      return res.status(404).json({
        success: false,
        error: { code: 'FROZEN_MEMBERSHIP_NOT_FOUND', message: 'No frozen membership found' },
      });
    }

    const currentFreeze = membership.freezeHistory[membership.freezeHistory.length - 1];
    const now = new Date();
    const frozenMs = now.getTime() - new Date(currentFreeze.startDate).getTime();
    const frozenDays = Math.max(1, Math.ceil(frozenMs / (1000 * 60 * 60 * 24)));

    // Extend endDate by the frozen days
    membership.endDate = new Date(membership.endDate.getTime() + frozenDays * 24 * 60 * 60 * 1000);
    currentFreeze.endDate = now;
    currentFreeze.daysFrozen = frozenDays;
    membership.status = 'active';

    await membership.save();
    return res.status(200).json({ success: true, message: 'Membership resumed and expiry extended', data: membership });
  } catch (err) {
    next(err);
  }
};