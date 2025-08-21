// Mock responses for Bookio API calls

export const mockServices = {
  success: true,
  services: [
    {
      id: 130113,
      name: "Service",
      workerId: 31576,
      duration: 10,
      price: null,
      currency: "€"
    }
  ]
};

export const mockAllowedDays = {
  data: {
    allowedDays: [15, 16, 17, 18, 19, 22, 23],
    year: 2025,
    month: 8
  }
};

export const mockAllowedTimes = {
  data: {
    times: {
      all: [
        {
          id: "09:00",
          name: "09:10",
          nameSuffix: "09:10 AM"
        },
        {
          id: "09:15",
          name: "09:25",
          nameSuffix: "09:25 AM"
        },
        {
          id: "14:30",
          name: "14:40",
          nameSuffix: "14:40 PM"
        },
        {
          id: "15:00",
          name: "15:10",
          nameSuffix: "15:10 PM"
        }
      ],
      mornings: {
        data: [
          {
            id: "09:00",
            name: "09:10",
            nameSuffix: "09:10 AM"
          },
          {
            id: "09:15",
            name: "09:25",
            nameSuffix: "09:25 AM"
          }
        ]
      },
      afternoon: {
        data: [
          {
            id: "14:30",
            name: "14:40",
            nameSuffix: "14:40 PM"
          },
          {
            id: "15:00",
            name: "15:10",
            nameSuffix: "15:10 PM"
          }
        ]
      }
    }
  }
};

export const mockBookingSuccess = {
  data: {
    success: true,
    order: {
      id: 12345,
      confirmationNumber: "ABC123",
      customerInfo: {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com"
      }
    }
  }
};

export const mockBookingFailure = {
  data: {
    success: false,
    errors: {
      general: ["The selected time slot is no longer available"]
    }
  }
};

export const mockCustomerInfo = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+421910123456",
  note: "Test booking"
};

export const mockInvalidCustomerInfo = {
  firstName: "",
  lastName: "Doe",
  email: "invalid-email",
  phone: "invalid-phone"
};

export const apiErrorResponse = {
  response: {
    status: 500,
    data: {
      error: "Internal server error",
      message: "Something went wrong"
    }
  }
};

export const networkError = new Error('Network Error');
networkError.code = 'ECONNREFUSED';