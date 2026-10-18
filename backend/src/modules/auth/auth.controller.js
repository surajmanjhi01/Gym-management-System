const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Gym = require('../../models/Gym');
const User = require('../../models/User');
const TenantMembership = require('../../models/TenantMembership');

exports.registerGymAndOwner = async (req, res, next) => {
  let createdGymId = null;
  let createdUserId = null;

  try {
    const { gymName, ownerName, email, phone, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'A user with this email already exists' },
      });
    }

    // 1. Generate unique slug
    const baseSlug = gymName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

    // 2. Create Gym Tenant
    const gym = await Gym.create({
      name: gymName,
      slug,
      contact: { phone, email },
    });
    createdGymId = gym._id;

    // 3. Create Owner User
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: ownerName,
      email,
      passwordHash,
    });
    createdUserId = user._id;

    // 4. Link User to Gym via TenantMembership
    await TenantMembership.create({
      tenantId: gym._id,
      userId: user._id,
      role: 'owner',
    });

    // 5. Generate Auth Token
    const token = jwt.sign(
      { userId: user._id, tenantId: gym._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      data: {
        gym: { id: gym._id, name: gym.name, slug: gym.slug },
        user: { id: user._id, name: user.name, email: user.email },
        token,
      },
    });
  } catch (err) {
    // Manual rollback if any step fails
    if (createdGymId) await Gym.findByIdAndDelete(createdGymId);
    if (createdUserId) await User.findByIdAndDelete(createdUserId);
    next(err);
  }
};