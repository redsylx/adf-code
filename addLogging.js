const fs = require('fs');
const path = require('path');

const LOG_COPY_NAME = "LoggingPipeline";

function getSourceTableName(activity) {
    return activity.inputs.filter(input => input.type == "DatasetReference")[0]?.parameters?.sourceTableName;
}

function createLogActivity_Copy(activity, index) {
    const sourceTableName = getSourceTableName(activity);
    return {
        name: `Log Copy ${index}`,
        type: "ExecutePipeline",
        dependsOn: [
            {
                activity: activity.name,
                dependencyConditions: [
                    "Completed"
                ]
            }
        ],
        policy: {
            secureInput: false
        },
        userProperties: [],
        typeProperties: {
            pipeline: {
                referenceName: LOG_COPY_NAME,
                type: "PipelineReference"
            },
            waitOnCompletion: true,
            parameters: {
                SourceTable: sourceTableName,
                TargetTable: "",
                UpdatedBy: {
                    value: "@pipeline().Pipeline",
                    type: "Expression"
                },
                ActivityResult: {
                    value: `@activity('${activity.name}')`,
                    type: "Expression"
                },
                ProcessName: activity.name
            }
        }
    }
}

function loadJson(fileName) {
    try {
        const jsonFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
        const filePath = path.join(__dirname, 'pipeline', jsonFileName);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(fileContent);
        return json;
    } catch (error) {
        console.error('loadJson:', error);
    }
}

function getListJsonFiles(filePath) {
    try {
        const folderPath = path.join(__dirname, filePath);
        const files = fs.readdirSync(folderPath);
        const jsonFiles = files.filter(file => path.extname(file) === '.json');
        return jsonFiles;
    } catch (error) {
        console.error("getListJsonFiles:", error)
    }
}

function saveJson(jsonObject, fileName) {
    try {
        const jsonFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
        const filePath = path.join(__dirname, 'pipeline', jsonFileName);
        const jsonString = JSON.stringify(jsonObject, null, 2);
        fs.writeFileSync(filePath, jsonString, 'utf8');
    } catch (error) {
        console.error('saveJson:', error);
    }
}

function updatePipeline(fileName) {
    let pipeline = loadJson(fileName)
    let activities = pipeline.properties.activities;
    let newActivitiesCount = 0;

    // find copy activities
    let copyActivities = activities.filter(activity => activity.type == "Copy");
    let logActivities = activities.filter(activity => activity.type === "ExecutePipeline" && activity.typeProperties?.pipeline?.referenceName === LOG_COPY_NAME)
    let skipCopyActivities = []

    for (let logActivity of logActivities) {
        let activityDependency = logActivity.dependsOn[0].activity
        skipCopyActivities.push(activityDependency);
    }

    // append loggin activities
    for (let i = 0; i < copyActivities.length; i++) {
        let copyActivity = copyActivities[i];
        if (skipCopyActivities.includes(copyActivity.name)) continue;
        console.log(i)
        let newActivity = createLogActivity_Copy(copyActivity, i + 1);
        activities.push(newActivity);
        newActivitiesCount++;
    }

    console.log("log added :", newActivitiesCount);
    if(!newActivitiesCount) return;
    saveJson(pipeline, fileName);
}

function maxActivities() {
    let jsonFiles = getListJsonFiles('pipeline')
    let arr = []
    jsonFiles.forEach(file => {
        const pipeline = loadJson(file)
        let totalCopy = 0;

        let activities = pipeline.properties?.activities;
        if (activities) {
            totalCopy = activities.filter(p => p.type == "Copy").length
        }

        arr.push({
            activity: pipeline.name,
            folder: pipeline.properties?.folder?.name ? "/" + pipeline.properties.folder.name : "/",
            total_activity: pipeline.properties?.activities?.length,
            total_copy_activity: totalCopy
        })
    });

    arr.sort((a, b) => b.total_copy_activity - a.total_copy_activity)
    console.table(arr)
}

// updatePipeline("SAPAUFKPER");
// maxActivities();