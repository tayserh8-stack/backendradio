/**
 * Audit Log Controller
 * Handles audit log retrieval, filtering, statistics, and export
 */

const { AuditLog, AuditAction } = require('../models/AuditLog');

/**
 * Get audit logs with filtering and pagination
 * GET /api/audit-logs
 */
const getAuditLogs = async (req, res) => {
  try {
    const { 
      userId, 
      action, 
      entity, 
      startDate, 
      endDate, 
      riskLevel,
      page = 1, 
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build query
    const query = {};
    
    // Filter by user
    if (userId) {
      query.user = userId;
    }
    
    // Filter by action
    if (action && Object.values(AuditAction).includes(action)) {
      query.action = action;
    }
    
    // Filter by entity
    if (entity) {
      query.entity = entity;
    }
    
    // Filter by risk level
    if (riskLevel && ['low', 'medium', 'high', 'critical'].includes(riskLevel)) {
      query.riskLevel = riskLevel;
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Only admins and managers can view audit logs
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      // Regular users can only see their own audit logs
      query.user = req.user._id;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Determine sort order
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query
    const [auditLogs, totalCount] = await Promise.all([
      AuditLog.find(query)
        .populate('user', 'username name')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        auditLogs,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get audit log by ID
 * GET /api/audit-logs/:id
 */
const getAuditLogById = async (req, res) => {
  try {
    const auditLog = await AuditLog.findById(req.params.id)
      .populate('user', 'username name email');
    
    if (!auditLog) {
      return res.status(404).json({
        success: false,
        message: 'سجل التدقيق غير موجود'
      });
    }
    
    // Check permissions: only admins, managers, or the user themselves can view
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && 
        !auditLog.user._id.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'لا لديك صلاحية لعرض هذا السجل'
      });
    }
    
    res.json({
      success: true,
      data: {
        auditLog
      }
    });
  } catch (error) {
    console.error('Error fetching audit log:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get audit log statistics
 * GET /api/audit-logs/stats
 */
const getAuditLogStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build match stage for aggregation
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        matchStage.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Only admins and managers can view statistics for all users
    let matchUserStage = {};
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      matchUserStage = { $match: { user: req.user._id } };
    }
    
    // Aggregation pipeline
    const pipeline = [
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      ...(Object.keys(matchUserStage).length ? [matchUserStage] : []),
      {
        $facet: {
          totalCount: [
            { $count: 'count' }
          ],
          byAction: [
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byEntity: [
            { $group: { _id: '$entity', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byRiskLevel: [
            { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byUser: [
            { $group: { _id: '$user', count: { $sum: 1 } } },
            { $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'userInfo'
            }},
            { $unwind: '$userInfo' },
            { $project: { _id: '$userInfo._id', name: '$userInfo.name', count: 1 } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          dailyActivity: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                  day: { $dayOfMonth: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
            { $limit: 30 }
          ]
        }
      }
    ];
    
    const result = await AuditLog.aggregate(pipeline);
    const stats = result[0] || {};
    
    // Format the results
    const formattedStats = {
      totalCount: stats.totalCount.length > 0 ? stats.totalCount[0].count : 0,
      byAction: stats.byAction.map(item => ({
        action: item._id,
        count: item.count
      })),
      byEntity: stats.byEntity.map(item => ({
        entity: item._id,
        count: item.count
      })),
      byRiskLevel: stats.byRiskLevel.map(item => ({
        riskLevel: item._id,
        count: item.count
      })),
      byUser: stats.byUser.map(item => ({
        userId: item._id,
        name: item.name,
        count: item.count
      })),
      dailyActivity: stats.dailyActivity.map(item => ({
        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
        count: item.count
      }))
    };
    
    res.json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    console.error('Error fetching audit log stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Export audit logs
 * GET /api/audit-logs/export
 */
const exportAuditLogs = async (req, res) => {
  try {
    const { 
      userId, 
      action, 
      entity, 
      startDate, 
      endDate, 
      riskLevel,
      format = 'csv'
    } = req.query;
    
    // Build query (same as getAuditLogs)
    const query = {};
    
    if (userId) {
      query.user = userId;
    }
    
    if (action && Object.values(AuditAction).includes(action)) {
      query.action = action;
    }
    
    if (entity) {
      query.entity = entity;
    }
    
    if (riskLevel && ['low', 'medium', 'high', 'critical'].includes(riskLevel)) {
      query.riskLevel = riskLevel;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Only admins and managers can export logs for others
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.user = req.user._id;
    }
    
    // Get audit logs (without pagination for export)
    const auditLogs = await AuditLog.find(query)
      .populate('user', 'username name')
      .sort({ createdAt: -1 });
    
    // Export based on format
    if (format === 'csv') {
      // CSV export
      const csvHeader = [
        'التاريخ',
        'المستخدم',
        'الدور',
        'الإجراء',
        'الكيان',
        'معرف الكيان',
        'مستوى المخاطر',
        'الوصف',
        'ملاحظات'
      ].join(',');
      
      const csvRows = auditLogs.map(log => {
        const date = new log.createdAt.toLocaleString('ar-SA');
        const user = log.user ? `${log.user.name} (${log.user.username})` : 'نظام';
        const role = log.userRole || '';
        const action = log.action || '';
        const entity = log.entity || '';
        const entityId = log.entityId || '';
        const riskLevel = log.riskLevel || '';
        const details = log.details ? JSON.stringify(log.details) : '';
        const notes = log.notes || '';
        
        return [
          `"${date}"`,
          `"${user}"`,
          `"${role}"`,
          `"${action}"`,
          `"${entity}"`,
          `"${entityId}"`,
          `"${riskLevel}"`,
          `"${details}"`,
          `"${notes}"`
        ].join(',');
      });
      
      const csvContent = [csvHeader, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().slice(0,10)}.csv`);
      return res.send(csvContent);
    } else if (format === 'json') {
      // JSON export
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().slice(0,10)}.json`);
      return res.send(JSON.stringify(auditLogs, null, 2));
    } else {
      return res.status(400).json({
        success: false,
        message: 'تنسيق التصدير غير مدعوم'
      });
    }
  } catch (error) {
    console.error('Error exporting audit logs:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get audit actions for filter dropdown
 * GET /api/audit-logs/actions
 */
const getAuditActions = async (req, res) => {
  try {
    const actions = Object.values(AuditAction).map(action => ({
      value: action,
      label: action
        .split(/(?=[A-Z])/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }));
    
    res.json({
      success: true,
      data: {
        actions
      }
    });
  } catch (error) {
    console.error('Error fetching audit actions:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

/**
 * Get audit entities for filter dropdown
 * GET /api/audit-logs/entities
 */
const getAuditEntities = async (req, res) => {
  try {
    // Get distinct entities from audit logs
    const entities = await AuditLog.distinct('entity');
    
    // Sort and format
    const formattedEntities = entities
      .filter(Boolean) // Remove null/empty
      .sort()
      .map(entity => ({
        value: entity,
        label: entity
      }));
    
    res.json({
      success: true,
      data: {
        entities: formattedEntities
      }
    });
  } catch (error) {
    console.error('Error fetching audit entities:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogById,
  getAuditLogStats,
  exportAuditLogs,
  getAuditActions,
  getAuditEntities
};