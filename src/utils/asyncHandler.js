const asyncHandler = (fn) => {
  return async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        const statusCode = Number.isInteger(error.statusCode)
            ? error.statusCode
            : 500;

        res.status(statusCode).json({
            message: error.message || "Internal server error",
            success: false
        });
        
    }   
    };
}

export {asyncHandler};
