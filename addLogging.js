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

function loadJSON(fileName) {
    const filePath = path.join(__dirname, 'pipeline', `${fileName}.json`);
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const pipeline = JSON.parse(fileContent);
        let activities = pipeline.properties.activities;

        // find copy activities
        let copyActivities = activities.filter(activity => activity.type == "Copy");

        // append loggin activities
        for (let i = 0; i < copyActivities.length; i++) {
            let copyActivity = copyActivities[i];
            let newActivity = createLogActivity_Copy(copyActivity, i + 1);
            activities.push(newActivity);
        }

        const updatedPipeline = JSON.stringify(pipeline, null, 2);
        fs.writeFileSync(filePath, updatedPipeline, 'utf8');
    } catch (error) {
        // Handle any errors that occurred during reading or parsing
        console.error('Error loading JSON:', error);
    }
}

loadJSON("SAPAUFKPER");