#!/usr/bin/env node

/**
 * Enhanced Booking System Validation Demo
 * Demonstrates the improved booking logic based on medical center patterns
 */

console.log('🧪 Enhanced Booking Validation Logic Demo');
console.log('==========================================');
console.log('');

// Simulated validation functions based on our enhanced configurations
class BookingValidation {
  
  validatePhoneNumber(phone) {
    const phonePattern = /^\+421[0-9]{9}$/;
    return {
      valid: phonePattern.test(phone),
      message: phonePattern.test(phone) 
        ? 'Telefónne číslo je platné' 
        : 'Prosím, zadajte platné slovenské telefónne číslo (+421XXXXXXXXX)'
    };
  }
  
  validateCustomerData(customer) {
    const errors = [];
    const requiredFields = ['firstName', 'lastName', 'phone'];
    
    // Check required fields
    requiredFields.forEach(field => {
      if (!customer[field] || customer[field].trim() === '') {
        errors.push(`Chýba povinné pole: ${field}`);
      }
    });
    
    // Validate phone if provided
    if (customer.phone) {
      const phoneCheck = this.validatePhoneNumber(customer.phone);
      if (!phoneCheck.valid) {
        errors.push(phoneCheck.message);
      }
    }
    
    // Validate name consistency
    if (customer.firstName && customer.lastName && customer.full_name) {
      const expectedFullName = `${customer.firstName} ${customer.lastName}`;
      if (customer.full_name !== expectedFullName) {
        errors.push('Meno a priezvisko sa nezhodujú s celým menom');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors,
      message: errors.length === 0 
        ? 'Údaje zákazníka sú platné' 
        : `Pre rezerváciu potrebujem: ${errors.join(', ')}`
    };
  }
  
  validateBookingRequest(request) {
    const errors = [];
    
    // Date validation
    if (!request.date) {
      errors.push('Dátum je povinný');
    } else if (!this.isValidDateFormat(request.date)) {
      errors.push('Neplatný formát dátumu. Použite DD.MM.YYYY');
    } else if (this.isDateInPast(request.date)) {
      errors.push('Nemôžem rezervovať termín v minulosti');
    }
    
    // Time validation  
    if (!request.time) {
      errors.push('Čas je povinný');
    } else if (!this.isValidTimeFormat(request.time)) {
      errors.push('Neplatný formát času. Použite HH:MM');
    }
    
    // ISO datetime validation
    if (!request.date_time) {
      errors.push('ISO formát dátumu a času je povinný pre validáciu');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors,
      message: errors.length === 0 ? 'Požiadavka na rezerváciu je platná' : errors.join(', ')
    };
  }
  
  isValidDateFormat(date) {
    return /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(date);
  }
  
  isValidTimeFormat(time) {
    return /^\d{1,2}:\d{2}$/.test(time);
  }
  
  isDateInPast(dateStr) {
    const [day, month, year] = dateStr.split('.');
    const inputDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inputDate < today;
  }
}

// Demo test cases
const validator = new BookingValidation();

console.log('📱 1. Phone Number Validation Tests:');
const phoneTests = [
  '+421901234567', // Valid
  '+421123456789', // Valid  
  '0901234567',    // Invalid - missing country code
  '+420901234567', // Invalid - wrong country
  '+42190123456'   // Invalid - too short
];

phoneTests.forEach(phone => {
  const result = validator.validatePhoneNumber(phone);
  console.log(`   ${phone}: ${result.valid ? '✅' : '❌'} ${result.message}`);
});

console.log('\n👤 2. Customer Data Validation Tests:');
const customerTests = [
  {
    name: 'Valid Customer',
    data: {
      firstName: 'Mária',
      lastName: 'Novák',
      full_name: 'Mária Novák',
      phone: '+421901234567',
      email: 'maria@example.sk'
    }
  },
  {
    name: 'Missing Phone',
    data: {
      firstName: 'Ján',
      lastName: 'Kováč',
      email: 'jan@example.sk'
    }
  },
  {
    name: 'Invalid Phone Format',
    data: {
      firstName: 'Peter',
      lastName: 'Novák',
      phone: '0901234567', // Missing country code
      email: 'peter@example.sk'
    }
  },
  {
    name: 'Name Mismatch',
    data: {
      firstName: 'Anna',
      lastName: 'Kvetková',
      full_name: 'Anna Novákova', // Doesn't match
      phone: '+421901234567',
      email: 'anna@example.sk'
    }
  }
];

customerTests.forEach(test => {
  const result = validator.validateCustomerData(test.data);
  console.log(`   ${test.name}: ${result.valid ? '✅' : '❌'} ${result.message}`);
});

console.log('\n📅 3. Booking Request Validation Tests:');
const bookingTests = [
  {
    name: 'Valid Booking Request',
    data: {
      action: 'book_appointment',
      date: '25.12.2025',
      time: '14:30',
      date_time: '2025-12-25T14:30:00',
      phone: '+421901234567',
      customer: {
        firstName: 'Mária',
        lastName: 'Novák',
        phone: '+421901234567'
      }
    }
  },
  {
    name: 'Past Date Request',
    data: {
      action: 'book_appointment', 
      date: '15.08.2023', // Past date
      time: '14:30',
      date_time: '2023-08-15T14:30:00',
      phone: '+421901234567'
    }
  },
  {
    name: 'Invalid Date Format',
    data: {
      action: 'book_appointment',
      date: '2025-12-25', // Wrong format
      time: '14:30',
      phone: '+421901234567'
    }
  },
  {
    name: 'Missing Required Fields',
    data: {
      action: 'book_appointment'
      // Missing date, time, phone
    }
  }
];

bookingTests.forEach(test => {
  const result = validator.validateBookingRequest(test.data);
  console.log(`   ${test.name}: ${result.valid ? '✅' : '❌'} ${result.message}`);
});

console.log('\n🔄 4. Enhanced Action Types Available:');
const enhancedActions = [
  'get_available_times',
  'get_soonest_available', 
  'get_more_slots',
  'book_appointment',
  'reschedule_appointment',
  'cancel_appointment'
];

enhancedActions.forEach(action => {
  console.log(`   ✅ ${action}`);
});

console.log('\n📊 5. Validation Response Examples:');

// Example validation responses
const validationResponses = {
  phone_invalid: "Prosím, zadajte platné slovenské telefónne číslo (+421XXXXXXXXX).",
  name_mismatch: "Meno a priezvisko sa nezhodujú. Prosím, skontrolujte údaje.",
  missing_required: "Pre rezerváciu potrebujem: firstName, lastName, phone.",
  appointment_conflict: "Na tento čas už máte rezervovaný termín. Ponúknem alternatívu.",
  date_invalid: "Dátum musí byť v budúcnosti. Prosím, vyberte iný dátum.",
  verification_needed: "Pre dokončenie rezervácie potrebujem vaše telefónne číslo.",
  data_confirmation: "Skontrolujme údaje: Mária Novák, telefón +421901234567, termín 25.12.2025 o 14:30. Súhlasíte?",
  slot_double_check: "Overujem dostupnosť termínu pred rezerváciou..."
};

Object.entries(validationResponses).forEach(([key, response]) => {
  console.log(`   ${key}: "${response}"`);
});

console.log('\n✅ Enhanced Booking Validation Demo Complete!');
console.log('');
console.log('🎯 Key Features Implemented:');
console.log('   • Slovak phone number validation (+421XXXXXXXXX)');
console.log('   • Required field validation (firstName, lastName, phone)');
console.log('   • Name consistency checking');
console.log('   • Date/time format validation');
console.log('   • Past date prevention'); 
console.log('   • ISO datetime requirement for validation');
console.log('   • Enhanced error messages in Slovak');
console.log('   • Customer verification process');
console.log('   • Booking integrity checks');
console.log('');
console.log('💡 This validation logic minimizes booking hassles by:');
console.log('   • Catching errors before API calls');
console.log('   • Providing clear, actionable error messages');
console.log('   • Preventing common booking mistakes');
console.log('   • Ensuring data consistency across all operations');
console.log('   • Supporting multiple validation layers');