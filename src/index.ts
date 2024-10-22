import { Model, Schema, SchemaType, isValidObjectId } from "mongoose";

/**
 * FindByReferenceInMongoose
 * FindByReferenceInMongoose function, used to find data by reference in Mongoose
 * @param schema - The Schema object of Mongoose
 */
export function FindByReferenceInMongoose(schema: Schema) {
  // Throw an error if the received is not a Schema
  if (schema.constructor.name !== "Schema") throw new Error("schemaTypeError");

  // Hook on the Schema
  schema.pre(
    ["find", "findOne", "distinct", "countDocuments"],
    async function () {
      /** Current Models */
      const models = this.model.db.models;

      // Check Models for emptiness
      if (Object.keys(models ?? {}).length === 0)
        throw new Error("modelCountError");

      /** Current Schema */
      const schema: Schema = this.model.schema;

      /**
       * Return the Model which connected with Ref Path.
       * @param obj
       * @returns
       */
      function getModel(obj: SchemaType): Model<any> | undefined {
        let refKey = "";
        if (obj?.instance === "ObjectID" || obj?.instance === "ObjectId") {
          // If it is Ref Path, read it directly
          const options = obj.options;
          if (options?.ref?.length) {
            refKey = options.ref;
          }
        } else if ((obj as any)?.$embeddedSchemaType) {
          // If it is an array, read the subitem Type
          return getModel((obj as any).$embeddedSchemaType);
        }
        return models[refKey];
      }

      /**
       * Transforms a path array into a reference path array
       * @param paths - The path array to be transformed
       * @param tSchema - The current Mongoose Schema object, default is the main Schema
       * @returns The transformed reference path array
       * @examples ['owner','name','en-US']  => ['owner', 'name.en-US']
       */
      function transPath2RefPath(
        paths: string[],
        tSchema: Schema = schema
      ): string[] {
        let previousPath: string[] = [];

        // If there are still paths that have not been converted
        while (paths.length > 0) {
          const path = paths.shift() ?? "";

          // If the Schema has this path
          if (tSchema.path([...previousPath, path].join("."))) {
            previousPath.push(path);
          } else {
            const currentModel = getModel(tSchema.path(previousPath.join(".")));
            if (currentModel) {
              const recurseResult = transPath2RefPath(
                [path, ...paths],
                currentModel.schema
              );
              if (!paths.length) {
                return [previousPath.join("."), ...recurseResult];
              } else {
                previousPath.push(...recurseResult);
              }
            } else return [...previousPath, path];
          }
        }
        return previousPath;
      }

      `
    Example:
    {
        $and:{
            'owner.name':'Dean',
            'infos.timestamp.createdAt':Date,
        },
        $or:[]
    }`;

      type Dict = { [key: string]: any };
      function flatten(
        dd: Dict,
        separator: string = ".",
        prefix: string = ""
      ): Dict {
        // transform nested object to dot notation
        `
        { person: { name: "John" } } to { "person.name": "John" }
      `;
        let result: Dict = {};

        for (let [k, v] of Object.entries(dd)) {
          let key = prefix ? `${prefix}${separator}${k}` : k;

          if (
            v.constructor === Object &&
            !Object.keys(v).some((checkKey) => checkKey.startsWith("$"))
          ) {
            let flatObject = flatten(v as Dict, separator, key);
            result = { ...result, ...flatObject };
          } else {
            result[key] = v;
          }
        }

        return result;
      }

      async function lookup(
        prevPaths: string[],
        conditions: Record<string, any>,
        cSchema = schema
      ): Promise<any> {
        // If Conditions cannot be analyzed, return it directly
        if (
          typeof conditions !== "object" ||
          conditions === null ||
          Object.keys(conditions).length === 0
        ) {
          return conditions;
        }

        /** Final result */
        const result: Record<string, any> = {};

        /**
         * Get the value of the previous Path
         */
        const prevPathsValue = cSchema.path(prevPaths.join("."));
        // console.log("prevPathsValue", prevPathsValue);
        if (prevPathsValue !== undefined && prevPathsValue.path === "_id") {
          return conditions;
        }
        for (let [paths, value] of Object.entries(conditions)) {
          // paths 1 = 'owner.name.en'; value 1 = 'Dean'

          // Determine whether Paths exists on Schema
          if (schema.path(paths)) {
          } else {
            const reduceResult = [
              ...transPath2RefPath(paths.split(".")),
              value as any,
            ].reduceRight((previousValue, currentValue) =>
              currentValue === "$"
                ? previousValue
                : { [currentValue]: previousValue }
            );
            [[paths, value]] = Object.entries(reduceResult);
          }

          // Current Paths array
          const currentPathsArray = paths.startsWith("$")
            ? paths === "$"
              ? prevPaths
              : []
            : [...prevPaths, paths];
          // Current Paths
          const currentPathsString = currentPathsArray.join(".");

          // The value corresponding to the current Paths
          const currentPathsValue = cSchema.path(currentPathsString);

          if (!paths.startsWith("$"))
            if (currentPathsValue === undefined) {
              const currentModel = getModel(prevPathsValue);
              if (currentModel) {
                const subConditions = await lookup(
                  [],
                  value,
                  currentModel.schema
                );
                if (subConditions) {
                  const ids = (
                    await currentModel.find(
                      flatten({ [paths]: subConditions }),
                      "_id"
                    )
                  ).map((v) => v._id);

                  return { $in: ids };
                }
              }
            }

          if (Array.isArray(value))
            Object.assign(result, {
              [paths]: await Promise.all(
                value.map(
                  async (v) => await lookup(currentPathsArray, v, cSchema)
                )
              ),
            });
          else if (
            typeof value === "object" &&
            value !== null &&
            Object.keys(value).length > 0 &&
            !isValidObjectId(value)
          )
            Object.assign(result, {
              [paths]: Object.fromEntries(
                await Promise.all(
                  Object.entries(value).map(
                    async ([k, v]) =>
                      Object.entries(
                        await lookup(
                          currentPathsArray,
                          {
                            [k]: v,
                          },
                          cSchema
                        )
                      )[0]
                  )
                )
              ),
            });
          else result[paths] = value;
        }
        return result;
      }
      (this as any)._conditions = await lookup([], (this as any)._conditions);
    }
  );
}
