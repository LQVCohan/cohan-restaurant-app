import 'dotenv/config.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  Role, User, Staff, Restaurant, SchedulingPolicy, Shift, SchedulePublication, ShiftAcknowledgement,
  Timesheet, AttendanceCorrectionRequest, OvertimeRequest, PayrollPeriod, PerformanceIncident, Notification,
  StaffPerformanceSnapshot
} from '../models/index.js';
import { applyPerformanceIncidentScore, markPerformanceIncidentEligible, waivePerformanceIncident } from '../src/services/performance/performanceIncident.service.js';
import { createPerformanceIncidentAppeal, reviewPerformanceIncidentAppeal, reverseScoreForAcceptedAppeal } from '../src/services/performance/performanceAppeal.service.js';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@123456';
const RESET = process.argv.includes('--reset');
const DEMO_TAG = '[demo-scheduling-pr21]';
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || '';

const CONCRETE_STAFF_ROLE_CONTRACT = [
  { slug: 'server', department: 'service', email: 'staff.server.demo@cohan.local', fullName: 'Demo Server', employmentType: 'full_time', workingDays: ['mon','tue','wed','thu','fri','sat'] },
  { slug: 'supervisor', department: 'service', email: 'staff.supervisor.demo@cohan.local', fullName: 'Demo Supervisor', employmentType: 'full_time', workingDays: ['mon','tue','wed','thu','fri'] },
  { slug: 'host', department: 'service', email: 'staff.host.demo@cohan.local', fullName: 'Demo Host', employmentType: 'part_time', workingDays: ['fri','sat','sun'] },
  { slug: 'cashier', department: 'cashier', email: 'staff.cashier.demo@cohan.local', fullName: 'Demo Cashier', employmentType: 'part_time', workingDays: ['tue','thu','sat'] },
  { slug: 'chef', department: 'kitchen', email: 'staff.chef.demo@cohan.local', fullName: 'Demo Chef', employmentType: 'full_time', workingDays: ['mon','tue','wed','thu','fri','sat'] },
  { slug: 'cook', department: 'kitchen', email: 'staff.cook.demo@cohan.local', fullName: 'Demo Cook', employmentType: 'full_time', workingDays: ['mon','tue','wed','thu','fri','sat'] },
  { slug: 'kitchen_helper', department: 'kitchen', email: 'staff.kitchenhelper.demo@cohan.local', fullName: 'Demo Kitchen Helper', employmentType: 'part_time', workingDays: ['wed','fri','sat'] },
  { slug: 'cleaner', department: 'cleaning', email: 'staff.cleaner.demo@cohan.local', fullName: 'Demo Cleaner', employmentType: 'part_time', workingDays: ['mon','wed','fri','sun'] },
  { slug: 'shipper', department: 'delivery', email: 'staff.shipper.demo@cohan.local', fullName: 'Demo Shipper', employmentType: 'part_time', workingDays: ['mon','tue','wed','thu','fri'] },
  { slug: 'storekeeper', department: 'inventory', email: 'staff.storekeeper.demo@cohan.local', fullName: 'Demo Storekeeper', employmentType: 'full_time', workingDays: ['mon','tue','wed','thu','fri'] },
  { slug: 'bartender', department: 'bar', email: 'staff.bartender.demo@cohan.local', fullName: 'Demo Bartender', employmentType: 'part_time', workingDays: ['thu','fri','sat','sun'] }
];

const DEMO_STAFF_EMAILS = [
  ...CONCRETE_STAFF_ROLE_CONTRACT.map((item) => item.email),
  'staff.fulltime.demo@cohan.local',
  'staff.parttime.demo@cohan.local',
  'staff.exception.demo@cohan.local'
];

const startOfNextWeek = () => { const n = new Date(); const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); const day = d.getUTCDay(); const add = (8 - (day || 7)); d.setUTCDate(d.getUTCDate() + add); return d; };
const at = (base, dayOffset, h, m=0) => new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()+dayOffset, h, m, 0, 0));

async function upsertRole(slug, name){ return Role.findOneAndUpdate({slug},{ $setOnInsert:{slug,name,isSystem:true}}, {upsert:true,new:true}); }
async function upsertBaseUser({email, fullName, userType, roleId, extra={}}){
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return User.findOneAndUpdate({email},{$set:{fullName,userType,role:roleId,status:'active',provider:'local',...extra},$setOnInsert:{passwordHash}},{upsert:true,new:true});
}



async function upsertStaffUser({ email, fullName, roleId, restaurantId, employmentType, workingDays, department }) {
  const existingUser = await User.findOne({ email }).select('_id userType').lean();
  if (existingUser && existingUser.userType !== 'STAFF') {
    throw new Error(`DEMO_EMAIL_CONFLICT_NOT_STAFF: ${email}`);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return Staff.findOneAndUpdate(
    { email },
    {
      $set: {
        fullName,
        userType: 'STAFF',
        role: roleId,
        status: 'active',
        provider: 'local',
        restaurantForStaff: restaurantId,
        refRestaurants: [restaurantId],
        employmentType,
        workingDays,
        primaryRestaurant: restaurantId,
        department
      },
      $setOnInsert: { passwordHash }
    },
    { upsert: true, new: true }
  );
}

async function resolveDemoRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID);
    if (!restaurant) {
      throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${DEMO_RESTAURANT_ID}`);
    }
    console.log(`Using existing restaurant: ${restaurant._id} - not modifying restaurant profile`);
    return restaurant;
  }

  const restaurant = await Restaurant.findOneAndUpdate(
    { name: 'Cohan Demo Restaurant - District 1', description: { $regex: DEMO_TAG } },
    {
      $set: {
        name: 'Cohan Demo Restaurant - District 1',
        address: { line1: '123 Demo Street', district: 'District 1', city: 'Ho Chi Minh City', country: 'Vietnam' },
        description: `PR21 demo ${DEMO_TAG}`
      }
    },
    { upsert: true, new: true }
  );
  console.log('Created/reused demo restaurant');
  return restaurant;
}
async function main(){
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const DB_NAME = process.env.MONGO_DB || 'foodhub';
  await mongoose.connect(MONGO_URI,{dbName:DB_NAME});
  console.log('Connected Mongo for demo seed (local/dev only).');

  const [adminR,managerR,hrR,accR,staffR] = await Promise.all([
    upsertRole('admin','Admin'),upsertRole('manager','Manager'),upsertRole('hr','HR'),upsertRole('accountant','Accountant'),upsertRole('staff','Staff')
  ]);

  const restaurant = await resolveDemoRestaurant();

  const admin = await upsertBaseUser({email:'admin.demo@cohan.local',fullName:'Demo Admin',userType:'ADMIN',roleId:adminR._id});
  const manager = await upsertBaseUser({email:'manager.demo@cohan.local',fullName:'Demo Manager',userType:'MANAGER',roleId:managerR._id,extra:{restaurantForStaff:restaurant._id,refRestaurants:[restaurant._id]}});
  await Restaurant.findByIdAndUpdate(restaurant._id, { $set: { managerId: manager._id } });
  const hr = await upsertBaseUser({email:'hr.demo@cohan.local',fullName:'Demo HR',userType:'HR',roleId:hrR._id,extra:{restaurantForStaff:restaurant._id,refRestaurants:[restaurant._id]}});
  const accountant = await upsertBaseUser({email:'accountant.demo@cohan.local',fullName:'Demo Accountant',userType:'ACCOUNTANT',roleId:accR._id,extra:{restaurantForStaff:restaurant._id,refRestaurants:[restaurant._id]}});
  const concreteRoleDocs = await Role.find({ slug: { $in: CONCRETE_STAFF_ROLE_CONTRACT.map((item) => item.slug) } }).select('_id slug').lean();
  const concreteRoleBySlug = new Map(concreteRoleDocs.map((item) => [item.slug, item]));
  const missingConcreteRoleSlugs = CONCRETE_STAFF_ROLE_CONTRACT.map((item) => item.slug).filter((slug) => !concreteRoleBySlug.has(slug));
  if (missingConcreteRoleSlugs.length) {
    throw new Error(`MISSING_CONCRETE_STAFF_ROLES: please run seedRoles before demo scheduling seed. missing=${missingConcreteRoleSlugs.join(',')}`);
  }

  const seededConcreteStaff = [];
  for (const item of CONCRETE_STAFF_ROLE_CONTRACT) {
    const roleDoc = concreteRoleBySlug.get(item.slug);
    seededConcreteStaff.push(await upsertStaffUser({ ...item, roleId: roleDoc._id, restaurantId: restaurant._id }));
  }

  const fulltime = await upsertStaffUser({email:'staff.fulltime.demo@cohan.local',fullName:'Demo Staff Fulltime',roleId:concreteRoleBySlug.get('server')._id,restaurantId:restaurant._id,employmentType:'full_time',workingDays:['mon','tue','wed','thu','fri','sat'],department:'service'});
  const parttime = await upsertStaffUser({email:'staff.parttime.demo@cohan.local',fullName:'Demo Staff Parttime',roleId:concreteRoleBySlug.get('cashier')._id,restaurantId:restaurant._id,employmentType:'part_time',workingDays:['tue','thu','sat'],department:'cashier'});
  const exception = await upsertStaffUser({email:'staff.exception.demo@cohan.local',fullName:'Demo Staff Exception',roleId:concreteRoleBySlug.get('cook')._id,restaurantId:restaurant._id,employmentType:'part_time',workingDays:['wed','fri','sat'],department:'kitchen'});

  const weekStart = startOfNextWeek(); const weekEnd = at(weekStart,6,23,59);
  if (RESET) {
    await Promise.all([
      Shift.deleteMany({restaurantId:restaurant._id, notes:{$regex:DEMO_TAG}}),
      Timesheet.deleteMany({restaurantId:restaurant._id, note:{$regex:DEMO_TAG}}),
      AttendanceCorrectionRequest.deleteMany({restaurantId:restaurant._id, note:{$regex:DEMO_TAG}}),
      OvertimeRequest.deleteMany({restaurantId:restaurant._id, note:{$regex:DEMO_TAG}}),
      PerformanceIncident.deleteMany({restaurantId:restaurant._id, note:{$regex:DEMO_TAG}}),
      Notification.deleteMany({restaurantId:restaurant._id, type:{$regex:'demo_|appeal|off_schedule|correction|overtime|incident'}}),
      ShiftAcknowledgement.deleteMany({note:{$regex:DEMO_TAG}}),
      User.deleteMany({ email: { $in: DEMO_STAFF_EMAILS }, userType: 'STAFF' }),
    ]);
  }

  await SchedulingPolicy.findOneAndUpdate({restaurantId:restaurant._id},{$set:{mandatoryShiftRoles:['cashier','kitchen','server'],'employmentTypePolicy.part_time.minWeeklyHours':12,'laborRules.weeklyHoursCap':48,'laborRules.maxShiftsPerDay':2,'availabilityRegistrationPolicy.treatMissingPartTimeSubmissionAsUnavailable':true,shiftTemplates:[{key:'morning',label:'Morning',startTime:'08:00',endTime:'14:00',enabled:true},{key:'evening',label:'Evening',startTime:'16:00',endTime:'22:00',enabled:true}]}},{upsert:true,new:true});

  const shifts = [];
  for (let i=0;i<3;i++) shifts.push(await Shift.findOneAndUpdate({restaurantId:restaurant._id,employeeId:fulltime._id,startTime:at(weekStart,i,8,0)},{ $set:{shiftType:'morning',startTime:at(weekStart,i,8,0),endTime:at(weekStart,i,14,0),notes:`${DEMO_TAG} valid shift`}}, {upsert:true,new:true}));
  const partShift = await Shift.findOneAndUpdate({restaurantId:restaurant._id,employeeId:parttime._id,startTime:at(weekStart,1,16,0)},{ $set:{shiftType:'evening',startTime:at(weekStart,1,16,0),endTime:at(weekStart,1,22,0),notes:`${DEMO_TAG} parttime available`}}, {upsert:true,new:true});
  const exceptionShift = await Shift.findOneAndUpdate({restaurantId:restaurant._id,employeeId:exception._id,startTime:at(weekStart,2,16,0)},{ $set:{shiftType:'evening',startTime:at(weekStart,2,16,0),endTime:at(weekStart,2,22,0),notes:`${DEMO_TAG} unavailable warning demo`}}, {upsert:true,new:true});

  await SchedulePublication.findOneAndUpdate({restaurantId:restaurant._id,periodStart:weekStart,periodEnd:weekEnd},{ $set:{status:'published',publishedAt:new Date(),publishedBy:manager._id,lastChangedAt:new Date()}},{upsert:true,new:true});
  await ShiftAcknowledgement.findOneAndUpdate({shiftId:shifts[0]._id,employeeId:fulltime._id},{ $set:{restaurantId:restaurant._id,status:'accepted',respondedAt:new Date(),note:`${DEMO_TAG} accepted`}},{upsert:true,new:true});
  await ShiftAcknowledgement.findOneAndUpdate({shiftId:exceptionShift._id,employeeId:exception._id},{ $set:{restaurantId:restaurant._id,status:'declined',respondedAt:new Date(),declineReason:'Unavailable',note:`${DEMO_TAG} declined`}},{upsert:true,new:true});

  const tNormal = await Timesheet.findOneAndUpdate({employeeId:fulltime._id,shiftId:shifts[0]._id,workDate:at(weekStart,0,0,0)},{ $set:{restaurantId:restaurant._id,plannedStartTime:at(weekStart,0,8),plannedEndTime:at(weekStart,0,14),actualCheckInAt:at(weekStart,0,8),actualCheckOutAt:at(weekStart,0,14),status:'completed',workedMinutes:360,hours:6,approved:true,note:`${DEMO_TAG}`}}, {upsert:true,new:true});
  const tLate = await Timesheet.findOneAndUpdate({employeeId:parttime._id,shiftId:partShift._id,workDate:at(weekStart,1,0,0)},{ $set:{restaurantId:restaurant._id,plannedStartTime:at(weekStart,1,16),plannedEndTime:at(weekStart,1,22),actualCheckInAt:at(weekStart,1,16,15),actualCheckOutAt:at(weekStart,1,22),latenessMinutes:15,status:'late',workedMinutes:345,hours:5.75,approved:true,note:`${DEMO_TAG}`}}, {upsert:true,new:true});
  await Timesheet.findOneAndUpdate({employeeId:fulltime._id,shiftId:shifts[1]._id,workDate:at(weekStart,1,0,0)},{ $set:{restaurantId:restaurant._id,plannedStartTime:at(weekStart,1,8),plannedEndTime:at(weekStart,1,14),actualCheckInAt:at(weekStart,1,8),actualCheckOutAt:at(weekStart,1,13,40),earlyLeaveMinutes:20,status:'early_leave',workedMinutes:340,hours:5.66,approved:true,note:`${DEMO_TAG}`}}, {upsert:true,new:true});
  const offPending = await Timesheet.findOneAndUpdate({employeeId:exception._id,isOffSchedule:true,workDate:at(weekStart,3,0,0)},{ $set:{restaurantId:restaurant._id,actualCheckInAt:at(weekStart,3,9),actualCheckOutAt:at(weekStart,3,12),isOffSchedule:true,offScheduleApprovalStatus:'pending',approved:false,status:'unscheduled_completed',note:`${DEMO_TAG}`}}, {upsert:true,new:true});

  const correctionPending = await AttendanceCorrectionRequest.findOneAndUpdate({restaurantId:restaurant._id,employeeId:fulltime._id,workDate:at(weekStart,1,0,0),status:'pending'},{ $setOnInsert:{restaurantId:restaurant._id,employeeId:fulltime._id,requestedBy:fulltime._id,timesheetId:tNormal._id,workDate:at(weekStart,1,0,0),status:'pending',reason:'Need checkout fix',note:`${DEMO_TAG}`}}, {upsert:true,new:true});
  await AttendanceCorrectionRequest.findOneAndUpdate({restaurantId:restaurant._id,employeeId:parttime._id,workDate:at(weekStart,1,0,0),status:'applied'},{ $setOnInsert:{restaurantId:restaurant._id,employeeId:parttime._id,requestedBy:parttime._id,timesheetId:tLate._id,workDate:at(weekStart,1,0,0),status:'applied',reviewedBy:manager._id,reviewedAt:new Date(),note:`${DEMO_TAG}`}}, {upsert:true,new:true});

  const otPending = await OvertimeRequest.findOneAndUpdate({restaurantId:restaurant._id,employeeId:fulltime._id,workDate:at(weekStart,2,0,0),status:'approved'},{ $setOnInsert:{restaurantId:restaurant._id,employeeId:fulltime._id,requestedBy:fulltime._id,workDate:at(weekStart,2,0,0),plannedOvertimeMinutes:60,approvedOvertimeMinutes:60,status:'approved',note:`${DEMO_TAG}`}}, {upsert:true,new:true});
  await OvertimeRequest.findOneAndUpdate({restaurantId:restaurant._id,employeeId:parttime._id,workDate:at(weekStart,4,0,0),status:'completed'},{ $setOnInsert:{restaurantId:restaurant._id,employeeId:parttime._id,requestedBy:parttime._id,workDate:at(weekStart,4,0,0),plannedOvertimeMinutes:45,actualOvertimeMinutes:40,approvedOvertimeMinutes:40,status:'completed',reviewedBy:manager._id,note:`${DEMO_TAG}`}}, {upsert:true,new:true});

  const periodStart = at(weekStart,0,0,0), periodEnd = at(weekStart,6,23,59);
  await PayrollPeriod.findOneAndUpdate({restaurantId:restaurant._id,startDate:periodStart,endDate:periodEnd},{ $set:{status:'open',lockedAt:null}},{upsert:true,new:true});

  const incidentLate = await PerformanceIncident.findOneAndUpdate({sourceType:'timesheet',sourceId:String(tLate._id),eventType:'ATTENDANCE_LATE'},{ $setOnInsert:{restaurantId:restaurant._id,employeeId:parttime._id,actorId:manager._id,actorRole:'MANAGER',sourceType:'timesheet',sourceId:String(tLate._id),uniqueKey:`timesheet:${tLate._id}:ATTENDANCE_LATE`,eventType:'ATTENDANCE_LATE',severity:'warning',responsibilityStatus:'pending_review',scoreImpactStatus:'pending',note:DEMO_TAG}}, {upsert:true,new:true});
  const incidentOffReject = await PerformanceIncident.findOneAndUpdate({sourceType:'off_schedule_attendance',sourceId:String(offPending._id),eventType:'OFF_SCHEDULE_REJECTED'},{ $setOnInsert:{restaurantId:restaurant._id,employeeId:exception._id,actorId:manager._id,actorRole:'MANAGER',sourceType:'off_schedule_attendance',sourceId:String(offPending._id),uniqueKey:`off_schedule_attendance:${offPending._id}:OFF_SCHEDULE_REJECTED`,eventType:'OFF_SCHEDULE_REJECTED',severity:'warning',responsibilityStatus:'staff_responsible',scoreImpactStatus:'pending',note:DEMO_TAG}}, {upsert:true,new:true});

  const ctx = { user: { id: manager._id, _id: manager._id, userType:'MANAGER', restaurantForStaff: restaurant._id, refRestaurants:[restaurant._id], roleName:'manager' } };
  await markPerformanceIncidentEligible({input:{incidentId:incidentLate._id,responsibilityStatus:'staff_responsible',proposedScoreDelta:-5,note:'Demo eligible'},ctx});
  await applyPerformanceIncidentScore({incidentId:incidentLate._id, actor: ctx.user, note:'Demo apply'});
  await waivePerformanceIncident({incidentId:incidentOffReject._id, reason:'Demo waived', ctx});

  await StaffPerformanceSnapshot.findOneAndUpdate({employeeId:fulltime._id,restaurantId:restaurant._id,periodStart:new Date(Date.UTC(weekStart.getUTCFullYear(),weekStart.getUTCMonth(),1)),periodEnd:new Date(Date.UTC(weekStart.getUTCFullYear(),weekStart.getUTCMonth()+1,0,23,59,59,999))},{ $setOnInsert:{finalPerformanceScore:100}},{upsert:true,new:true});

  const appeal = await createPerformanceIncidentAppeal({incidentId:incidentLate._id,reason:'Xin xem xét do kẹt xe demo'}, {id:parttime._id,_id:parttime._id,userType:'STAFF',restaurantForStaff:restaurant._id,refRestaurants:[restaurant._id]});
  await reviewPerformanceIncidentAppeal({appealId:appeal._id,status:'accepted',decisionReason:'Accepted for demo',reviewNote:'ok'}, ctx.user);
  await reverseScoreForAcceptedAppeal({appealId:appeal._id,actor:ctx.user,reversalDelta:5,note:'reverse demo'});

  console.log('Seeded/Reused demo scheduling-attendance-performance data successfully.');
  console.log('Demo accounts password:', DEMO_PASSWORD);
  await mongoose.disconnect();
}

main().catch(async (e)=>{ console.error(e); await mongoose.disconnect(); process.exit(1);});
