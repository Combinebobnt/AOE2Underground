// code by Combinebobnt for AoE2 Underground ranking system

/**
 * Import player aoe2.net API string
 * @param {number} player_id - Player id
 * @param {boolean} is_tg - Is teamgame
 * @return {string} - aoe2.net API data
 */
function GET_API_DATA(player_id, is_tg)
{
  if(is_tg === undefined)
  {
    is_tg = 0;
  }
  let url = "https://aoe2.net/api/player/ratinghistory?game=aoe2de&leaderboard_id=3&count=200&profile_id=" + player_id
  if(is_tg)
  {
    url = "https://aoe2.net/api/player/ratinghistory?game=aoe2de&leaderboard_id=4&count=200&profile_id=" + player_id
  }

  let response = UrlFetchApp.fetch(url);
  let response_data = response.getBlob().getDataAsString();
  return response_data;
}

/**
 * Update aoe2.net API data for all players in "Automated Ratings"
 */
function UPDATE_PLAYER_API_DATA()
{
  Logger.log("UPDATE_PLAYER_API_DATA()");
  ratings_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Automated Ratings");
  ratings_sheet_range = ratings_sheet.getRange("$A2:T");
  ratings_sheet_range_values = ratings_sheet_range.getValues();

  const column_player_id = 1;
  const column_api_1v1 = 17;
  const column_api_tg = 18;
  let requests_1v1 = [];
  let requests_tg = [];

  Logger.log("Generating API requests...");
  for(let r = 0; r < ratings_sheet_range.getNumRows(); r++)
  {
    // stop once at blank row
    if(ratings_sheet_range_values[r][column_player_id] == "")
    {
      break;
    }

    let player_id = ratings_sheet_range_values[r][column_player_id];
    requests_1v1.push("https://aoe2.net/api/player/ratinghistory?game=aoe2de&leaderboard_id=3&count=200&profile_id=" + player_id);
    requests_tg.push("https://aoe2.net/api/player/ratinghistory?game=aoe2de&leaderboard_id=4&count=200&profile_id=" + player_id);
  }

  if(requests_1v1.length == 0)
  {
    Logger.log("No API data collected.");
    return;
  }

  let response_1v1 = UrlFetchApp.fetchAll(requests_1v1);
  let response_tg = UrlFetchApp.fetchAll(requests_tg);

  if(response_1v1.length != response_tg.length)
  {
    throw new Error("1v1 and tg response length difference.");
  }
  Logger.log("Total requests made = " + requests_1v1.length);

  let responses_combined = [];
  for(let x = 0; x < requests_1v1.length; x++)
  {
    responses_combined.push([response_1v1[x], response_tg[x]]);
  }

  Logger.log("Updating player API data...");
  let cells_to_change = ratings_sheet.getRange("R2C" + column_api_1v1 + ":R" + (2 + response_1v1.length - 1) + "C" + column_api_tg);
  cells_to_change.setValues(responses_combined);
}

/**
 * Gets player elo from aoe2.net API string
 * @param {string} apistring - aoe2.net match data API string
 * @param {boolean} is_tg - Is teamgame
 * @return {number} - Player elo, 0 if error
 */
function GETELO(apistring, is_tg)
{
  if(is_tg === undefined)
  {
    is_tg = 0;
  }
  if(is_tg)
  {
    // remove any rating entries before the teamgame elo adjustment
    const re_adjust = /"[\w\d":,\-]*timestamp":(16[0123456]|166[0123])\d+.*/g;
    apistring = apistring.replace(re_adjust, '');
  }

  // extract all MMRs from the API text
  const re_ratings = /(?<="rating":)\d+/g;
  try
  {
    elo = Number(apistring.match(re_ratings)[0]);
  }
  catch(TypeError)
  {
    elo = 0;
  }
  return elo;
}

/**
 * Gets player max elo from aoe2.net API string
 * @param {string} apistring - aoe2.net match data API string
 * @param {number} is_tg - Is teamgame
 * @return {number} - Player max elo, 0 if error
 */
function GETMAXELO(apistring, is_tg)
{
  if(is_tg === undefined)
  {
    is_tg = 0;
  }
  if(is_tg)
  {
    // remove any rating entries before the teamgame elo adjustment
    const re_adjust = /"[\w\d":,\-]*timestamp":(16[0123456]|166[0123])\d+.*/g;
    apistring = apistring.replace(re_adjust, '');
  }

  // extract all MMRs from the API text
  const re_ratings = /(?<="rating":)\d+/g;
  const array = [...apistring.matchAll(re_ratings)];
  max = 0;

  // find the biggest MMRs (max)
  for (let i = 0; i < array.length; i++)
  {
      mmr = Number(array[i][0]);
      if(mmr > max)
      {
        max = mmr;
      }
  }
  return max;
}

const ratings = [
"F", 
"E", 
"D", 
"C", 
"B", 
"A", 
"S", 
"S+", 
"S++", 
"S+++", 
"S++++", 
"S+++++"
];

/**
 * Converts player elo to tier letter
 * @param {number} elo - Player elo
 * @param {number} group_size - Elo points difference between different tiers
 * @param {number} c_tier_rating - Median elo for C tier
 * @return {string} - Tier letter
 */
function ELOTOTIER(elo, group_size=200, c_tier_rating=1500)
{
  const c_tier_rating_index = ratings.indexOf("C");
  
  i = Math.floor((elo + (group_size / 2) - c_tier_rating) / group_size) + c_tier_rating_index;

  // prevent out-of-bounds
  i = i <= 0 ? 0 : i;
  i = i >= ratings.length - 1 ? ratings.length - 1 : i;

  return ratings[i];
}

/**
 * Converts tier letter to numeric value
 * @param {string} tier_letter - Tier letter
 * @return {number} - Tier numeric value
 */
function TIERNUM(tier_letter)
{
  let retval = ratings.indexOf(tier_letter);
  if(retval < 0 || retval > ratings.length)
  {
    retval = "";
  }
  return retval;
}

/**
 * Adds player/id to "Data Entry" sheet
 * @param {string} name - Player discord name
 * @param {number} id - Player aoe2.net id
 */
function ADD_TO_DATA_ENTRY(name, id)
{
  data_entry_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data Entry");
  data_entry_sheet_range = data_entry_sheet.getRange("$A2:B");
  data_entry_sheet_values = data_entry_sheet_range.getValues();
  let add_new = true;
  let last_row = 0
  // iterate over each row in data entry
  for(let r = 0; r < data_entry_sheet_range.getNumRows(); r++)
  {
    if(id == data_entry_sheet_values[r][1])
    {
      add_new = false;
      break;
    }
    if(data_entry_sheet_values[r][1] == "")
    {
      last_row = r;
      break;
    }
  }
  if(add_new)
  {
    data_entry_sheet_first_row = data_entry_sheet.getRange("$A" + (last_row + 3) + ":B" + (last_row + 3));
    data_entry_sheet_first_row.insertCells(SpreadsheetApp.Dimension.ROWS);
    // +2 instead of +3 since this is starting at index 1 instead of 0 (array)
    data_entry_sheet.getRange("$A" + (last_row + 2)).setValue(name);
    data_entry_sheet.getRange("$B" + (last_row + 2)).setValue(id);
  }
}

/**
 * Get tier for player id
 * @param {number} player_id - Player aoe2.net id
 * @return {string} - Tier letter
 */
function GET_PLAYER_TIER(player_id)
{
  player_info_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Player Info");
  player_info_sheet_range = player_info_sheet.getRange("$A2:L");
  player_info_sheet_values = player_info_sheet_range.getValues();

  for(let x = 0; x < player_info_sheet_range.getNumRows(); x++)
  {
    const player_id_column = 1;
    const player_tier_column = 9;
    if(player_info_sheet_values[x][player_id_column] == player_id)
    {
      return player_info_sheet_values[x][player_tier_column];
    }
  }
  return "";
}

/**
 * Record individual player sign up and store to "Data Entry" sheet
 */
function RECORD_INDIVIDUAL_SIGN_UP()
{
  signup_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Individual Sign Ups");
  signup_sheet_range = signup_sheet.getRange("$A2:C");
  signup_sheet_values = signup_sheet_range.getValues();

  // iterate over each row in sign ups
  for(let r = 0; r < signup_sheet_range.getNumRows(); r++)
  {
    // skip blank rows
    if(signup_sheet_values[r][0] == "")
    {
      continue;
    }
    Logger.log("RECORD_INDIVIDUAL_SIGN_UP() signup_sheet_values[" + r + "][2] = " + signup_sheet_values[r][2]);
    player_name = signup_sheet_values[r][1];
    player_id = signup_sheet_values[r][2];
    // add player to data entry list
    ADD_TO_DATA_ENTRY(player_name, player_id);
  }
}

/**
 * Record team sign up and lock in tier for each player. 
 */
function RECORD_TEAM_SIGN_UP()
{
  player_info_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Player Info");
  player_info_sheet_range = player_info_sheet.getRange("$A2:L");
  player_info_sheet_values = player_info_sheet_range.getValues();

  signup_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Team Sign Ups");
  signup_sheet_range = signup_sheet.getRange("$A2:L");
  signup_sheet_values = signup_sheet_range.getValues();

  let tier_columns = [];
  signup_sheet_headers = signup_sheet.getRange("$A$1:$M$1");
  signup_sheet_headers_values = signup_sheet_headers.getValues();
  // iterate each column header to find the tier columns
  for(let c = 0; c < signup_sheet_range.getNumColumns(); c++)
  {
    const re_tier = /Tier/i;
    match = signup_sheet_headers_values[0][c].match(re_tier);
    if(match !== null)
    {
      tier_columns.push(c);
    }
  }

  // iterate over each row in sign ups
  for(let r = 0; r < signup_sheet_range.getNumRows(); r++)
  {
    // skip blank rows
    if(signup_sheet_values[r][0] == "")
    {
      continue;
    }

    for(let p = 0; p < tier_columns.length; p++)
    {
      Logger.log("RECORD_TEAM_SIGN_UP() signup_sheet_values[" + r + "][tier_columns[" + p + "]] = " + signup_sheet_values[r][tier_columns[p]]);
      if(signup_sheet_values[r][tier_columns[p]] == "")
      {
        player_name = signup_sheet_values[r][tier_columns[p] - 2];
        player_id = signup_sheet_values[r][tier_columns[p] - 1];
        // also add player to data entry list
        ADD_TO_DATA_ENTRY(player_name, player_id);
        cell_to_change = signup_sheet.getRange("R" + (r + 2) + "C" + (tier_columns[p] + 1));
        cell_to_change.setValue(GET_PLAYER_TIER(player_id));
        Logger.log("RECORD_TEAM_SIGN_UP() signup_sheet_values[" + r + "][tier_columns[" + p + "]] = " + cell_to_change.getValues());
        break;
      }
    }
  }
}

/**
 * Record substitute player sign up and lock in their tier. 
 */
function RECORD_SUB_SIGN_UP()
{
  player_info_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Player Info");
  player_info_sheet_range = player_info_sheet.getRange("$A2:L");
  player_info_sheet_values = player_info_sheet_range.getValues();

  signup_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sub Sign Ups");
  signup_sheet_range = signup_sheet.getRange("$A2:E");
  signup_sheet_values = signup_sheet_range.getValues();

  let tier_columns = [];
  signup_sheet_headers = signup_sheet.getRange("$A$1:$E$1");
  signup_sheet_headers_values = signup_sheet_headers.getValues();
  // iterate each column header to find the tier columns
  for(let c = 0; c < signup_sheet_range.getNumColumns(); c++)
  {
    const re_tier = /Tier/i;
    match = signup_sheet_headers_values[0][c].match(re_tier);
    if(match !== null)
    {
      tier_columns.push(c);
    }
  }

  // iterate over each row in sign ups
  for(let r = 0; r < signup_sheet_range.getNumRows(); r++)
  {
    // skip blank rows
    if(signup_sheet_values[r][0] == "")
    {
      continue;
    }

    for(let p = 0; p < tier_columns.length; p++)
    {
      Logger.log("RECORD_SUB_SIGN_UP() signup_sheet_values[" + r + "][tier_columns[" + p + "]] = " + signup_sheet_values[r][tier_columns[p]]);
      if(signup_sheet_values[r][tier_columns[p]] == "")
      {
        player_name = signup_sheet_values[r][tier_columns[p] - 2];
        player_id = signup_sheet_values[r][tier_columns[p] - 1];
        // also add player to data entry list
        ADD_TO_DATA_ENTRY(player_name, player_id);
        cell_to_change = signup_sheet.getRange("R" + (r + 2) + "C" + (tier_columns[p] + 1));
        cell_to_change.setValue(GET_PLAYER_TIER(player_id));
        Logger.log("RECORD_SUB_SIGN_UP() signup_sheet_values[" + r + "][tier_columns[" + p + "]] = " + cell_to_change.getValues());
        break;
      }
    }
  }
}

/**
 * Update all forms, to be used with Trigger.
 */
function FORM_UPDATES()
{
  RECORD_TEAM_SIGN_UP()
  RECORD_INDIVIDUAL_SIGN_UP()
  RECORD_SUB_SIGN_UP()
}
