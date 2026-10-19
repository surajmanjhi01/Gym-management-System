const Member = require('../../models/Member');
const Counter = require('../../models/Counter');
const { registerMemberSchema, updateMemberSchema } = require('./members.validation');

// 1. Add / Register a Member
exports.createMember = async (req, res, next) => {
  try {
    const validatedData = registerMemberSchema.parse(req.body);

    // Generate formatted member ID: MEM-0001, MEM-0002...
    const nextSeq = await Counter.getNextSequence(req.tenantId, 'memberCode');
    const memberCode = `MEM-${String(nextSeq).padStart(4, '0')}`;

    const member = await Member.create({
      ...validatedData,
      tenantId: req.tenantId,
      memberCode,
      createdBy: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      data: member,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};

// 2. Search & Paginate Members
exports.getMembers = async (req, res, next) => {
  try {
    const { search, status = 'active', page = 1, limit = 20 } = req.query;

    const query = {
      tenantId: req.tenantId,
      ...(status !== 'all' && { status }),
    };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { fullName: searchRegex },
        { phone: searchRegex },
        { memberCode: searchRegex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [members, total] = await Promise.all([
      Member.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Member.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: members,
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

// 3. Get Single Member
exports.getMemberById = async (req, res, next) => {
  try {
    const member = await Member.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!member) {
      return res.status(404).json({
        success: false,
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member does not exist in this gym' },
      });
    }

    return res.status(200).json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
};

// 4. Update Member Details
exports.updateMember = async (req, res, next) => {
  try {
    const validatedData = updateMemberSchema.parse(req.body);

    const member = await Member.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: validatedData },
      { new: true, runValidators: true }
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found' },
      });
    }

    return res.status(200).json({ success: true, data: member });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    next(err);
  }
};

// 5. Soft-Delete / Archive Member
exports.archiveMember = async (req, res, next) => {
  try {
    const member = await Member.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: { status: 'archived', archivedAt: new Date() } },
      { new: true }
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Member archived successfully',
    });
  } catch (err) {
    next(err);
  }
};