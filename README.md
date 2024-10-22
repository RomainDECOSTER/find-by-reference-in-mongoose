# find-by-reference-in-mongoose

This is a Mongoose plugin that allows your Mongoose to support lookup on reference fields.

Reference field is like this:

```typescript
{
    type: MongooseSchema.Types.ObjectId,
    ref: 'XXX',
  }
```

Its principle is to parse your find request. When it finds that you want to filter the value of the reference field, it will read the model corresponding to the reference field and perform the search, obtain the id array that matches the filter, and then put the reference field The filter of the value is replaced by the judgment of whether the value of the reference field is in the id array.

# install

```bash
npm i -S find-by-reference-in-mongoose
```

# usage

The `find-by-reference-in-mongoose` module exposes a single function that you can
pass to [Mongoose schema's `plugin()` function](https://mongoosejs.com/docs/api.html#schema_Schema-plugin).

```javascript
const { FindByReferenceInMongoose } = require("find-by-reference-in-mongoose");
const schema = new mongoose.Schema({
  /* ... */
});
schema.plugin(FindByReferenceInMongoose);
```

Then, you can use it like this.

```typescript
const result = await catModel
  .find({
    $and: {
      parents: {
        "owner.name": "Dean",
      },
      sex: 0,
    },
  })
  .exec();
```

Its conditions will be automatically replaced with:

```typescript
const newConditions = {
  $and: {
    parents: {
      $in: [
        /* ObjectIDs for Eligible Cats */
      ],
    },
    sex: 0,
  },
};
```
