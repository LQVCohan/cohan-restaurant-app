import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/index.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const staffList = await User.find({ userType: 'STAFF' }).select('_id restaurantForStaff primaryRestaurant refRestaurants rate rateCount').lean();
  let migratedRestaurantForStaffCount = 0;
  let unsetPrimaryRestaurantCount = 0;
  let unsetRefRestaurantsCount = 0;
  let unsetRateCount = 0;
  const missingIds = [];

  for (const s of staffList) {
    const set = {};
    const unset = {};
    if (!s.restaurantForStaff && s.primaryRestaurant) {
      set.restaurantForStaff = s.primaryRestaurant;
      migratedRestaurantForStaffCount += 1;
    }
    if (!s.restaurantForStaff && !s.primaryRestaurant) missingIds.push(String(s._id));
    if (s.primaryRestaurant) { unset.primaryRestaurant = 1; unsetPrimaryRestaurantCount += 1; }
    if (s.refRestaurants?.length) { unset.refRestaurants = 1; unsetRefRestaurantsCount += 1; }
    if (s.rate != null || s.rateCount != null) { unset.rate = 1; unset.rateCount = 1; unsetRateCount += 1; }
    for (const [k,v] of Object.entries({baseSalary:0,gender:'unspecified',maritalStatus:'unspecified',contractType:'none',salaryType:'monthly',trainingStatus:'not_started'})) {
      if (s[k] == null) set[k]=v;
    }
    if (Object.keys(set).length || Object.keys(unset).length) await User.updateOne({_id:s._id}, {$set:set, $unset:unset});
  }
  console.log({scannedCount: staffList.length,migratedRestaurantForStaffCount,unsetPrimaryRestaurantCount,unsetRefRestaurantsCount,unsetRateCount,missingRestaurantForStaffCount:missingIds.length,missingRestaurantForStaffIds:missingIds});
  await mongoose.disconnect();
}
run().catch(async (e)=>{console.error(e); await mongoose.disconnect(); process.exit(1);});
