/*
 * Author: Alejandro Asensio <alejandro.asensio@bsc.es>
 * Created at: 2020-04-25 11:30
 * 
 * Description: This script extracts the test set from the MongoDB for
 * the MESINESP task.
 * 
 * Usage:
 * 
 * First, if you are not at the BSC office, connect through VPN to BSC:
 * $ sudo openfortivpn gw.bsc.es:443 -u USERNAME
 * 
 * Then, execute the JavaScript file with the mongo shell:
 * $ mongo <thisfilename>.js
 * 
 * GOTCHA: This script contains some syntax compatible with mongo version 4.2 onwards, such as $merge.
 * This script was run in localhost mongo version 4.2 like so:
 * $ mongo extract-test-set.js
 * 
 * And then uploaded to production mongo version 4.0 like so:
 * $ mongodump --archive --db=BvSalud --collection=test_set_with_annotations | mongorestore --host=bsccnio01.bsc.es --archive --db=BvSalud --collection=test_set_with_annotations
 * $ mongodump --archive --db=BvSalud --collection=test_set_without_annotations | mongorestore --host=bsccnio01.bsc.es --archive --db=BvSalud --collection=test_set_without_annotations
 */

// connection to required databases
var bvsalud = db.getSiblingDB('BvSalud')
var datasets = db.getSiblingDB('datasets')

// create a temporary database
var tmp = db.getSiblingDB('tmp')

// gather candidates for test set
// var candidates = [
//     bvsalud.selected_importants,
//     datasets.isciii,
//     datasets.reec
// ]
// candidates.forEach(function (candidate) {
//     candidate.aggregate([
//         { $merge: { into: { db: 'tmp', coll: 'candidates' } } }
//     ])
// })

bvsalud.selected_importants.aggregate([
    { $merge: { into: { db: 'tmp', coll: 'candidates' } } }
])
datasets.isciii.aggregate([
    { $merge: { into: { db: 'tmp', coll: 'candidates' } } }
])
datasets.reec.aggregate([
    { $merge: { into: { db: 'tmp', coll: 'candidates' } } }
])

// remove duplicates regarding the pair fields: spanish title and spanish abstract
tmp.candidates.aggregate([
    {
        $group: {
            _id: { ti_es: "$ti_es", ab_es: "$ab_es" },
            duplicates: { $addToSet: "$_id" },
            count: { $sum: 1 }
        }
    },
    { $match: { count: { "$gt": 1 } } }
],
    { allowDiskUse: true }
).forEach(function (document) {
    document.duplicates.shift();
    tmp.candidates.remove({ _id: { $in: document.duplicates } })
})

// gather previous development to be later excluded
var excluded_collections = [
    // bvsalud.training_set_original,
    bvsalud.development_set_union
]
excluded_collections.forEach(function (collection) {
    collection.aggregate([
        { $merge: { into: { db: 'tmp', coll: 'excluded' } } }
    ])
})
var excluded_ids = tmp.excluded.distinct('_id')

// get the double validated docs ids
var annotators_ids = bvsalud.users.distinct('id', { role: 'annotator' })
bvsalud.validations.aggregate([
    { $match: { 'user': { $in: annotators_ids } } },
    { $project: { docs: 1, _id: 0 } },
    { $unwind: '$docs' },
    { $group: { _id: '$docs', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $merge: { into: { db: 'tmp', coll: 'double_validated_ids' } } }
])
var double_validated_ids = tmp.double_validated_ids.distinct('_id')
print('double validated docs: ' + double_validated_ids.length)

// build the test set
tmp.candidates.aggregate([
    { $match: { '_id': { $in: double_validated_ids, $nin: excluded_ids }, } },
    {
        $set: {
            id: '$_id',
            title: '$ti_es',
            abstractText: '$ab_es',
            journal: { $arrayElemAt: ['$ta', 0] },
            db: '$db',
            year: { $year: '$entry_date' },
            decsCodes: []
        }
    },
    {
        $project: {
            id: 1,
            title: 1,
            abstractText: 1,
            journal: 1,
            db: 1,
            year: 1,
            decsCodes: 1
        }
    },
    { $merge: { into: { db: 'BvSalud', coll: 'test_set_without_annotations_mongoshell' } } }
])
printjson(bvsalud.test_set_without_annotations_mongoshell.count())

