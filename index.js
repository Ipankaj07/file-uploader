require("dotenv").config();
const url = process.env.MONGODB_URI;
const dbName = "backend_task";

const express = require("express");
const multer = require("multer");
const assert = require("assert");

const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");

const app = express();
const upload = multer();

app.get("/", (req, res) => {
  res.send("Hey! This is a file upload app");
});

app.listen(process.env.PORT, async () => {
  await MongoClient.connect(url, { useNewUrlParser: true }, (err, client) => {
    assert.equal(null, err);
    console.log("Connected successfully to server");

    const db = client.db(dbName);
    const bucket = new GridFSBucket(db, { bucketName: "files" });

    app.post("/upload", upload.single("file"), (req, res) => {
      const file = req.file;

      if (!file) {
        return res.send("Please select a file");
      }

      const uploadStream = bucket.openUploadStream(file.originalname);

      uploadStream.write(file.buffer);
      uploadStream.end();

      uploadStream.on("error", (err) => {
        console.log(err);
      });

      uploadStream.on("finish", (file) => {
        // console.log(file);
        res.send({
          message: "File uploaded and saved to database",
          file_url: `/file/${file._id}`,
        });
      });
    });

    app.get("/file", (req, res) => {
      bucket.find({}).toArray((err, files) => {
        if (err) {
          console.log(err);
        } else {
          res.send(files);
        }
      });
    });

    app.get("/file/:id", (req, res) => {
      const fileId = req.params.id;
      bucket.find({ _id: new ObjectId(fileId) }).toArray((err, files) => {
        if (err) {
          return res.send(err);
        }
        if (files.length === 0) {
          return res.send("File not found");
        }

        res.set("Content-Type", files[0].contentType);
        res.set("Accept-Ranges", "bytes");
        res.set("Content-Length", files[0].length);

        const downloadStream = bucket.openDownloadStream(new ObjectId(fileId));

        downloadStream.on("data", (chunk) => {
          res.write(chunk);
        });

        downloadStream.on("error", () => {
          res.sendStatus(404);
        });

        downloadStream.on("end", () => {
          res.end();
        });
      });
    });
  });
  console.log("server running on port " + process.env.PORT);
});
