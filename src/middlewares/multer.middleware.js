import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);

        cb(null, `${uuidv4()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {

    const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(
            new Error("Only JPEG, PNG and WebP images are allowed")
        );
    }

    cb(null, true);
};

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
        files: 1
    },

    fileFilter: fileFilter
});

export default upload;