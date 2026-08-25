class ApiError extends Error {
    constructor(statusCode,message="Something went wrong", error=[],stack,) {
        if (typeof statusCode === "string" && Number.isInteger(message)) {
            [statusCode, message] = [message, statusCode];
        }

        super(message);
        this.statusCode = Number.isInteger(statusCode) ? statusCode : 500;
        this.success = false;
        this.error = error;
        
        if(stack) {
            this.stack = stack;
        }
        else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
export {ApiError};
