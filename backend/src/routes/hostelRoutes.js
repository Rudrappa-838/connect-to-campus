const express = require('express');
const router = express.Router();
const hostelController = require('../controllers/hostelController');

// Hostel Routes
router.use(require('../middleware/authMiddleware').authenticateToken);

router.get('/', hostelController.getAllHostels);
router.post('/', hostelController.createHostel);
router.put('/:id', hostelController.updateHostel);
router.delete('/:id', hostelController.deleteHostel);

// Room Routes
router.get('/:hostelId/rooms', hostelController.getHostelRooms);
router.post('/:hostelId/rooms', hostelController.addRoom);
router.put('/rooms/:id', hostelController.updateRoom);
router.delete('/rooms/:id', hostelController.deleteRoom);

// Allocation Routes
router.get('/unallocated-students', hostelController.getUnallocatedStudents);
router.post('/rooms/:roomId/allocate', hostelController.allocateRoom);
router.post('/rooms/:roomId/bulk-allocate', hostelController.bulkAllocateRoom);
router.post('/allocations/:id/vacate', hostelController.vacateRoom);
router.put('/allocations/:id', hostelController.updateAllocation);
router.get('/:hostelId/allocations', hostelController.getAllocationsByHostel);

// Finance Routes
// Finance Routes
router.get('/finance/stats', hostelController.getHostelStats);
router.post('/finance/bulk-mess-bill', hostelController.generateBulkMessBills);
router.get('/finance/pending-dues', hostelController.getPendingDues);
router.get('/my-details', hostelController.getMyHostelDetails); // Student Self-Service
router.get('/student/:admissionNo/details', hostelController.getStudentHostelDetails);
router.post('/finance/mess-bill', hostelController.addMessBill);
router.post('/finance/payment', hostelController.recordPayment);

// New Finance Routes
router.get('/finance/students', hostelController.getAllHostelStudents);
router.get('/finance/students/:studentId/history', hostelController.getStudentPaymentHistory);
router.post('/finance/assign-fee', hostelController.assignHostelFee);
router.post('/finance/students/:studentId/pay', hostelController.receiveHostelPayment);
router.put('/finance/payments/:paymentId/due-date', hostelController.updateHostelFeeDueDate);
router.put('/finance/bulk-due-date', hostelController.bulkUpdateDueDate);

// Attendance Routes
router.get('/attendance/daily', hostelController.getDailyAttendance);
router.post('/attendance/daily', hostelController.markDailyAttendance);
router.get('/attendance/monthly', hostelController.getMonthlyAttendanceReport);

module.exports = router;
