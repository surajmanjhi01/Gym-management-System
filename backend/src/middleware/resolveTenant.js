const TenantMembership = require('../models/TenantMembership');

module.exports = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        error: { code: 'TENANT_REQUIRED', message: 'Session has no active tenant context' },
      });
    }

    const membership = await TenantMembership.findOne({
      tenantId,
      userId: req.user.userId,
      status: 'active',
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: { code: 'TENANT_FORBIDDEN', message: 'Access to this gym is denied' },
      });
    }

    // Attach trusted values to the request
    req.tenantId = membership.tenantId;
    req.userRole = membership.role;
    next();
  } catch (err) {
    next(err);
  }
};