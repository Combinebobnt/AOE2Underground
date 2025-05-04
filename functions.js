// code by Combinebobnt and LilyBear for AoE2 Underground ranking system

let DEFAULT_FORM_ID = "1P_6IY5DayrAvwwPgoPCnAU6aC8LvsSGJ-UW4CKdkIOA"
let DATA_FORM_ID = "1P_6IY5DayrAvwwPgoPCnAU6aC8LvsSGJ-UW4CKdkIOA"

/**
 * Convert alphabetical letter to a number
 * @param {string} letter - letter of alphabet
 * @return {number} - number of the letter ('a' == 1)
 */
function LETTER_TO_INT(letter)
{
  if(letter === undefined || letter.length != 1)
  {
    return null;
  }
  return parseInt(letter, 36) - 9;
}

/**
 * Find column number of header
 * @param {array} row_values - array (the row) of values to search
 * @param {string} header_name - header name to search for
 * @return {number} - column number of matching header, null if not found
 */
function FIND_COLUMN_HEADER(row_values, header_name)
{
  // iterate each column header
  for(let c = 0; c < row_values.length; c++)
  {
    const re_search = new RegExp(header_name, "i");
    match = row_values[c].match(re_search);
    if(match !== null)
    {
      return c;
    }
  }
  return null;
}

/**
 * Call UPDATE_PLAYER_API_DATA() one at a time
 */
function UPDATE_PLAYER_API_DATA_MANUAL_BUTTON()
{
  let cache = CacheService.getUserCache();
  let cached = cache.get("already_called");
  if(cached == "YES")
  {
    Browser.msgBox('Wait 30 sec between manual player data refreshes.');
    return;
  }
  cache.put('already_called', 'YES', 30); // 30 sec cooldown
  UPDATE_PLAYER_API_DATA();
}

// populates player_info
function PARSE_API_RESPONSE(responses, player_info) {
  responses.forEach(function (response, index) {
    const parsed_json = JSON.parse(response);

    let stat_id_to_profile_id = {};

    parsed_json.statGroups.forEach(function (group, index) {
      // record api stat id; needed to get leaderboard stats
      stat_id_to_profile_id[group.id] = group.members[0].profile_id;
      // record player alias (steam name)
      player_info[group.members[0].profile_id]["alias"] = group.members[0].alias;
      // record player country
      player_info[group.members[0].profile_id]["country"] = group.members[0].country;
    });

    // get leaderboard stats for each player
    leaderboards_filtered = parsed_json.leaderboardStats.filter(group => group.leaderboard_id === 3 || group.leaderboard_id === 4);
    leaderboards_filtered.forEach(function (group, index) {
      let leaderboard_id = group.leaderboard_id;
      let stat_id = group.statgroup_id;
      let profile_id = stat_id_to_profile_id[stat_id];
      if(leaderboard_id === 3) // 1v1 rm
      {
        player_info[profile_id]["1v1_games"] = group.wins + group.losses;
        player_info[profile_id]["1v1_rating"] = group.rating;
        if(group.highestrating < group.rating)
        {
          player_info[profile_id]["1v1_rating_max"] = group.rating;
        }
        else
        {
          player_info[profile_id]["1v1_rating_max"] = group.highestrating;
        }
      }
      else if(leaderboard_id === 4) // tg rm
      {
        player_info[profile_id]["tg_games"] = group.wins + group.losses;
        player_info[profile_id]["tg_rating"] = group.rating;
        if(group.highestrating < group.rating)
        {
          player_info[profile_id]["tg_rating_max"] = group.rating;
        }
        else
        {
          player_info[profile_id]["tg_rating_max"] = group.highestrating;
        }
      }
    });
  });
}

/**
 * Update aoe2 API data for all players in "Automated Ratings"
 */
function UPDATE_PLAYER_API_DATA()
{
  Logger.log("UPDATE_PLAYER_API_DATA() enter");
  ratings_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Automated Ratings");
  ratings_sheet_range = ratings_sheet.getRange("$A2:T");
  ratings_sheet_range_values = ratings_sheet_range.getValues();

  const column_player_id_0base = LETTER_TO_INT('B') - 1;
  const column_steam_name = LETTER_TO_INT('D'); // first column to write
  const column_last = LETTER_TO_INT('K');
  const start_row = 0;

  let ids_to_request = [];
  let player_info = {};
  const request_base = "https://aoe-api.worldsedgelink.com/community/leaderboard/GetPersonalStat?title=age2&profile_ids=[";
  let request = request_base;
  let requests = [];

  Logger.log("Generating API requests...");
  let count = 0;
  let total_count = 0;
  for(let r = start_row; r < ratings_sheet_range.getNumRows(); r++)
  {
    // stop once at blank row
    if(ratings_sheet_range_values[r][column_player_id_0base] == "")
    {
      break;
    }

    let player_id = ratings_sheet_range_values[r][column_player_id_0base];

    request += "%22" + String(player_id) + "%22,"; // trailing comma works
    ids_to_request.push(player_id);
    player_info[player_id] = {
      "alias": "",
      "country": "",
      "1v1_games": 0,
      "1v1_rating": 0,
      "1v1_rating_max": 0,
      "tg_games": 0,
      "tg_rating": 0,
      "tg_rating_max": 0,
    };
    count += 1;
    total_count += 1;
    // split requests in groups of 100 to not exceed URL length limit
    if(count >= 100)
    {
      count = 0;
      request += "]";
      requests.push(request);
      request = request_base;
    }
  }
  if(count > 0)
  {
    count = 0;
    request += "]";
    requests.push(request);
  }

  if(ids_to_request.length == 0)
  {
    Logger.log("No API data collected.");
    return;
  }

  Logger.log("Processing requests...");
  let responses = [];
  requests.forEach(function (request, index) {
    responses.push(UrlFetchApp.fetch(request));
  });
  Logger.log("Total players requested = " + ids_to_request.length);

  Logger.log("Updating player API data...");

  PARSE_API_RESPONSE(responses, player_info)

  let data_to_write = [];
  for(let r = start_row; r < ratings_sheet_range.getNumRows(); r++)
  {
    // stop once at blank row
    if(ratings_sheet_range_values[r][column_player_id_0base] == "")
    {
      break;
    }

    let player_id = ratings_sheet_range_values[r][column_player_id_0base];
    if(player_info[player_id] != undefined)
    {
      data_to_write.push([
        player_info[player_id]["alias"],
        player_info[player_id]["country"],
        player_info[player_id]["1v1_rating"], 
        player_info[player_id]["1v1_rating_max"], 
        player_info[player_id]["tg_rating"], 
        player_info[player_id]["tg_rating_max"], 
        player_info[player_id]["1v1_games"], 
        player_info[player_id]["tg_games"], 
      ])
    }
  }
  let cells_to_change = ratings_sheet.getRange("R" + (start_row + 2) + "C" + column_steam_name + ":R" + (start_row + 2 + total_count - 1) + "C" + column_last);
  cells_to_change.setValues(data_to_write);
}



/**
 * Update aoe2 API data for a list of specified players in "Automated Ratings"
 */
function UPDATE_SPECIFIED_PLAYER_API_DATA(player_ids_to_update) {
  if (player_ids_to_update.length == 0) {
    return
  }
  Logger.log("[UPDATE_SPECIFIED_PLAYER_API_DATA] for "+player_ids_to_update.toString());
  ratings_sheet = SpreadsheetApp.openById(DATA_FORM_ID).getSheetByName("Automated Ratings");
  ratings_sheet_range = ratings_sheet.getRange("$A2:T");
  ratings_sheet_range_values = ratings_sheet_range.getValues();

  const column_player_id_0base = LETTER_TO_INT('B') - 1;
  const column_steam_name = LETTER_TO_INT('D'); // first column to write
  const column_last = LETTER_TO_INT('K');
  const start_row = 0;

  let player_info = {};
  const request_base = "https://aoe-api.worldsedgelink.com/community/leaderboard/GetPersonalStat?title=age2&profile_ids=[";
  let request = request_base;

  let row_to_fill = []

  for(let r = start_row; r < ratings_sheet_range.getNumRows(); r++) {
    // stop once at blank row
    if(ratings_sheet_range_values[r][column_player_id_0base] == "")
    {
      break;
    }
    
    let player_id = ratings_sheet_range_values[r][column_player_id_0base];

    if (player_ids_to_update.includes(player_id)) {
      row_to_fill.push([r+2, player_id]); // pair of row and player id, note that row offset is 2 (one for header, one for 0->1 idx)
      request += "%22" + player_id + "%22,"; // trailing comma works
      player_info[player_id] = {
        "alias": "",
        "country": "",
        "1v1_games": 0,
        "1v1_rating": 0,
        "1v1_rating_max": 0,
        "tg_games": 0,
        "tg_rating": 0,
        "tg_rating_max": 0,
      };
    }
  }

  request += "]";
  Logger.log("[UPDATE_SPECIFIED_PLAYER_API_DATA] Generated API request "+request);
  Logger.log("[UPDATE_SPECIFIED_PLAYER_API_DATA] Processing API requests...");
  let responses = [];
  responses.push(UrlFetchApp.fetch(request))

  Logger.log("[UPDATE_SPECIFIED_PLAYER_API_DATA] Updating player API data...");

  PARSE_API_RESPONSE(responses, player_info)
  for (let i = 0; i < row_to_fill.length; i++) {
    row = row_to_fill[i][0]
    player_id = row_to_fill[i][1]
    let data_to_write =  [
      player_info[player_id]["alias"],
      player_info[player_id]["country"],
      player_info[player_id]["1v1_rating"], 
      player_info[player_id]["1v1_rating_max"], 
      player_info[player_id]["tg_rating"], 
      player_info[player_id]["tg_rating_max"], 
      player_info[player_id]["1v1_games"], 
      player_info[player_id]["tg_games"], 
    ]
    let cells_to_change = ratings_sheet.getRange("R" + row + "C" + column_steam_name + ":R" + row+ "C" + column_last);
    Logger.log("[UPDATE_SPECIFIED_PLAYER_API_DATA] row " + row + " writing "+data_to_write.join(" "))
    cells_to_change.setValues([data_to_write]) 
  }
}

const ratings = [
"0", 
"1", 
"2", 
"3", 
"4", 
"5", 
"6", 
"7", 
"8", 
"9", 
"10", 
"11"
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
 * Get tier for player id
 * @param {number} player_id - Player aoe2.net id
 * @return {string} - Tier letter
 */
function GET_PLAYER_TIER(player_id)
{
  player_info_sheet = SpreadsheetApp.openById(DATA_FORM_ID).getSheetByName("Player Info Extra");
  player_info_sheet_range = player_info_sheet.getRange("$A2:J");
  player_info_sheet_values = player_info_sheet_range.getValues();

  const player_id_column_0base = LETTER_TO_INT('B') - 1;
  const player_tier_column_0base = LETTER_TO_INT('J') - 1;
  for(let x = 0; x < player_info_sheet_range.getNumRows(); x++)
  {
    if(player_info_sheet_values[x][player_id_column_0base] == player_id)
    {
      return player_info_sheet_values[x][player_tier_column_0base];
    }
  }
  return "";
}

/**
 * Adds player/id to "Data Entry" sheet
 * @param {string} name - Player discord name
 * @param {number} id - Player aoe2.net id
 * @param {string} looking_for_team - Player looking for team
 * @param {string} preferred_position - Player preferred position
 */
function ADD_TO_DATA_ENTRY(name, id, looking_for_team="", preferred_position="")
{
  const looking_for_team_col_letter = "$C";
  const looking_for_team_col_base0 = LETTER_TO_INT('C') - 1;
  const preferred_position_col_letter = "$J";
  const preferred_position_col_base0 = LETTER_TO_INT('J') - 1;

  data_entry_sheet = SpreadsheetApp.openById(DATA_FORM_ID).getSheetByName("Data Entry");
  data_entry_sheet_range = data_entry_sheet.getRange("$A$2:" + preferred_position_col_letter);
  data_entry_sheet_values = data_entry_sheet_range.getValues();

  let add_new = true;
  let last_row = 0;
  let row_to_edit = 0;

  // iterate over each row in data entry
  for(let r = 0; r < data_entry_sheet_range.getNumRows(); r++)
  {
    if(id == data_entry_sheet_values[r][1])
    {
      add_new = false;
      row_to_edit = r;
      break;
    }
    if(data_entry_sheet_values[r][1] == "")
    {
      last_row = r;
      row_to_edit = last_row;
      break;
    }
  }
  if(add_new)
  {
    data_entry_sheet_first_row = data_entry_sheet.getRange("$A" + (last_row + 3) + ":B" + (last_row + 3));
    data_entry_sheet_first_row.insertCells(SpreadsheetApp.Dimension.ROWS);
    // +2 instead of +3 since this is starting at index 1 instead of 0 (array)
    data_entry_sheet.getRange("$A" + (row_to_edit + 2)).setValue(name);
    data_entry_sheet.getRange("$B" + (row_to_edit + 2)).setValue(id);
  }
  // only update values if they changed on the sign up
  if(looking_for_team != "No" && looking_for_team != data_entry_sheet_values[row_to_edit][looking_for_team_col_base0])
  {
    data_entry_sheet.getRange(looking_for_team_col_letter + (row_to_edit + 2)).setValue(looking_for_team);
  }
  if(preferred_position != data_entry_sheet_values[row_to_edit][preferred_position_col_base0])
  {
    data_entry_sheet.getRange(preferred_position_col_letter + (row_to_edit + 2)).setValue(preferred_position);
  }
}

/**
 * Record individual player sign up and store to "Data Entry" sheet
 * @param {bool} record_tiers - Record player tiers permanently
 */
function RECORD_INDIVIDUAL_SIGN_UP(record_tiers=false)
{
  Logger.log("RECORD_INDIVIDUAL_SIGN_UP() enter");
  signup_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Individual Sign Ups");
  signup_sheet_range = signup_sheet.getRange("$A$2:$H");
  signup_sheet_values = signup_sheet_range.getValues();

  const name_col_0base = LETTER_TO_INT('B') - 1;
  const id_col_0base = LETTER_TO_INT('C') - 1;
  const looking_for_team_col_0base = LETTER_TO_INT('D') - 1;
  const preferred_position_col_0base = LETTER_TO_INT('E') - 1;
  const subbing_col_0base = LETTER_TO_INT('F') - 1;

  let tier_columns = [];
  if(record_tiers)
  {
    signup_sheet_headers = signup_sheet.getRange("$A$1:$H$1");
    signup_sheet_headers_values = signup_sheet_headers.getValues();
    let column_number = FIND_COLUMN_HEADER(signup_sheet_headers_values[0], "Sub Tier");
    if(column_number === null)
    {
      throw new Error("Sub Tier column not found.");
    }
    tier_columns.push(column_number);
  }

  // iterate over each row in sign ups
  for(let r = 0; r < signup_sheet_range.getNumRows(); r++)
  {
    // skip blank rows
    if(signup_sheet_values[r][0] == "")
    {
      continue;
    }
    if(r % 10 == 0)
    {
      Logger.log("Updating data entry row = " + r + "...");
    }
    // Logger.log("RECORD_INDIVIDUAL_SIGN_UP() signup_sheet_values[" + r + "][id_col_0base] = " + signup_sheet_values[r][id_col_0base]);
    let player_name = signup_sheet_values[r][name_col_0base];
    let player_id = signup_sheet_values[r][id_col_0base];
    let looking_for_team = signup_sheet_values[r][looking_for_team_col_0base];
    let preferred_position = signup_sheet_values[r][preferred_position_col_0base];
    let subbing = signup_sheet_values[r][subbing_col_0base];
  
    ADD_TO_DATA_ENTRY(player_name, player_id, looking_for_team, preferred_position);
  
    // record sub tier
    if(record_tiers)
    {
      if(subbing === undefined || subbing == "")
      {
        continue;
      }
      if(subbing.length > 0)
      {
        cell_to_change = signup_sheet.getRange("R" + (r + 2) + "C" + (tier_columns[0] + 1));
        cell_to_change.setValue(GET_PLAYER_TIER(player_id));
        Logger.log("Record sub signup: signup_sheet_values[" + r + "][tier_columns[0] = " + cell_to_change.getValues());
      }
    }
  }
}


function RECORD_TEAM_SIGN_UP(tournament_name, sheet_id=DEFAULT_FORM_ID) {
  tournament_name = "SS3"
  sign_up_sheet = tournament_name+" Sign Ups"
  Logger.log("[RECORD_TEAM_SIGN_UP] Begin execution")
  new_players = RECORD_TEAM_SIGN_UP_POPULATE_PLAYERS (sign_up_sheet, false, sheet_id)
  Logger.log("[RECORD_TEAM_SIGN_UP] New team with players "+new_players.toString())
  // add players to data list
  new_player_ids = []
  if (new_players.length == 0) {
    Logger.log("[RECORD_TEAM_SIGN_UP] No new players found, terminating")
    return
  }
  for (let p = 0; p < new_players.length; p++) {
    player_name = new_players[p][0]
    player_id = new_players[p][1]
    new_player_ids.push(player_id)
    ADD_TO_DATA_ENTRY(player_name, player_id)
    Logger.log("[RECORD_TEAM_SIGN_UP] Added to DATA ENTRY "+player_name + " id "+player_id)
  }
  UPDATE_SPECIFIED_PLAYER_API_DATA(new_player_ids)
  new_player_info = RECORD_TEAM_SIGN_UP_POPULATE_PLAYERS(sign_up_sheet, true, sheet_id)
  UPDATE_PLAYER_EXTRA_INFO(tournament_name, new_player_info)
}

// requires the team header followed by tier, named "[tournament_name] Team", "[tournament_name] Tier"
function UPDATE_PLAYER_EXTRA_INFO(tournament, new_player_info) {
  team_header = tournament+" Team"
  sheet = SpreadsheetApp.openById(DEFAULT_FORM_ID).getSheetByName("Player Info Extra")
  header_range = sheet.getRange("$A1:CF");
  header = header_range.getValues()[0]
  col_header_idx = FIND_COLUMN_HEADER(header, team_header)
  Logger.log("[UPDATE_PLAYER_EXTRA_INFO] Found header "+team_header+ " at col "+ col_header_idx)
  sheet_range = sheet.getRange("$A2:CF");
  vals = sheet_range.getValues()
  for (let i = 0; i < vals.length; i++) {
    player_name = vals[i][0]
    if (player_name in new_player_info) {
      let cells_to_change = sheet.getRange("R" + i + "C" + (col_header_idx+1)+":R" + i + "C" + (col_header_idx+2))
      cells_to_change.setValues([new_player_info[player_name]])
      Logger.log("[UPDATE_PLAYER_EXTRA_INFO] Updated player "+player_name+ " to (team, tier)"+ new_player_info[player_name].toString())
    }
  } 
}


/**
 * Record team sign up
 * The signup sheet must follow the format of columns: timestamp, team name, unused, (player name, player id, tier) f
 * or 1-4 players, followed by rest
 * Also the column for team total must be written as "Team Total"
 * Team Name column fixed
 * @param {bool} record_tiers - Record player tiers permanently
 */
function RECORD_TEAM_SIGN_UP_POPULATE_PLAYERS(active_tournament, record_tiers=false, form_id=DEFAULT_FORM_ID)
{
  Logger.log("[RECORD_TEAM_SIGN_UP_POPULATE_PLAYERS] " + active_tournament);
  signup_sheet = SpreadsheetApp.openById(form_id).getSheetByName(active_tournament)
  signup_sheet_range = signup_sheet.getRange("$A2:Z");
  signup_sheet_values = signup_sheet_range.getValues();

  let tier_columns = [];
  signup_sheet_headers = signup_sheet.getRange("$A$1:$Z$1");
  signup_sheet_headers_values = signup_sheet_headers.getValues();
  // iterate each column header to find the tier columns
  for(let c = 0; c < signup_sheet_range.getNumColumns(); c++) {
    const re_tier = /Tier/i;
    match = signup_sheet_headers_values[0][c].match(re_tier);
    if(match !== null) {
      tier_columns.push(c);
    }
  }
  let team_name_col = FIND_COLUMN_HEADER(signup_sheet_headers_values[0], "Team Name")

  player_per_team = tier_columns.length
  if (!record_tiers) {
    Logger.log("[RECORD_TEAM_SIGN_UP_POPULATE_PLAYERS] Tournament is "+player_per_team+" players per team")
  }

  let new_players = []
  let new_team_info = {} // dict of mapping of team name of list of team members + tiers
  // iterate over each row in sign ups
  for(let r = 0; r < signup_sheet_range.getNumRows(); r++)
  {
    // skip blank rows
    if(signup_sheet_values[r][0] == "") {
      continue;
    }
    let team_total = 0
    for(let p = 0; p < tier_columns.length; p++) {
      if(signup_sheet_values[r][tier_columns[p]] == "") {
        player_name = signup_sheet_values[r][tier_columns[p] - 2];
        player_id = signup_sheet_values[r][tier_columns[p] - 1];
        team_name = signup_sheet_values[r][team_name_col]
        if (!record_tiers) {
          Logger.log("[RECORD_TEAM_SIGN_UP_POPULATE_PLAYERS] Found new player "+player_name+" with id "+ player_id +" under team "+team_name)
          new_players.push([player_name, player_id])
        } else {
          cell_to_change = signup_sheet.getRange("R" + (r + 2) + "C" + (tier_columns[p] + 1))
          let player_tier = GET_PLAYER_TIER(player_id)
          new_team_info[player_name]=[team_name, player_tier]
          team_total += player_tier
          Logger.log("[RECORD_TEAM_SIGN_UP_POPULATE_PLAYERS] Updated tier for "+ player_name + " to " +player_tier)
          cell_to_change.setValue(GET_PLAYER_TIER(player_id));
        }

        if (record_tiers){
          let team_total_col = FIND_COLUMN_HEADER(signup_sheet_headers_values[0], "Team Total")
          cell_to_change = signup_sheet.getRange("R" + (r + 2) + "C" + (team_total_col + 1))
          Logger.log("[RECORD_TEAM_SIGN_UP_POPULATE_PLAYERS] Updated team total to "+team_total)
          cell_to_change.setValue(team_total);
        }
      }
    }

  }
  if (!record_tiers) {
    return new_players
  } else {
    Logger.log("[RECORD_TEAM_SIGN_UP_POPULATE_PLAYERS] Returning team info "+JSON.stringify(new_team_info))
    return new_team_info
  }
}

/**
 * Update all forms; to be used with Trigger.
 */
function FORM_UPDATES()
{
  let active_tournament = "KotU Team Sign Ups" // put the name of the spreadsheet for the current tournament
  let active_format = "1v1"
  RECORD_INDIVIDUAL_SIGN_UP()
  RECORD_TEAM_SIGN_UP(active_tournament)

  UPDATE_PLAYER_API_DATA()

  // Allow time for tiers to get calculated
  Utilities.sleep(10 * 1000);

  // log player tiers after api data fetched
  RECORD_INDIVIDUAL_SIGN_UP(true)
  RECORD_TEAM_SIGN_UP(active_tournament, true)
}

function SINGLE_TOURNAMENT_FORM_UPDATE() {
  Logger.log("begin executing SINGLE_TOURNAMENT_FORM_UPDATE")
  
}

/**
 * Calculate season points for player
 * @param {number} game_wins - Games won
 * @param {number} mvps - MVPs received
 * @param {number} result - Tournament result (1, 2, 3, ...)
 * @return {number} - Season points
 */
function CALCULATE_SEASON_POINTS(game_wins, mvps, result)
{
  if(game_wins === undefined || game_wins === "")
  {
    game_wins = 0;
  }
  if(mvps === undefined || mvps === "")
  {
    mvps = 0;
  }
  if(result === undefined || result === "")
  {
    result = 0;
  }

  let season_points = 0;
  season_points += game_wins * 2;
  season_points += mvps;
  if(result == 1)
  {
    season_points += 8;
  }
  else if(result == 2)
  {
    season_points += 5;
  }
  else if(result == 3 || result == 4)
  {
    season_points += 2;
  }

  return season_points;
}

/**
 * Parse Smurf Database string for alt account names
 * @param {string} smurf_database_string - string containing all API data returned
 * @return {string} - list of profiles "id: name" comma separated
 */
function PARSE_SMURF_DATABASE_STRING(smurf_database_string)
{
  if(smurf_database_string === undefined || smurf_database_string == "")
  {
    return "";
  }
  const re_search_name = new RegExp("(?<=\"name\":\")[^\"]+", "ig");
  name_matches = Array.from(smurf_database_string.matchAll(re_search_name));
  if(name_matches === undefined || name_matches.length == 0)
  {
    return "";
  }
  const re_search_id = new RegExp("(?<=profile_id:\")[^\"]+", "ig");
  id_matches = Array.from(smurf_database_string.matchAll(re_search_id));
  if(id_matches === undefined || id_matches.length == 0 || id_matches.length != name_matches.length)
  {
    return "";
  }
  let retval = "";
  for(let i = 0; i < name_matches.length; i++)
  {
    retval += id_matches[i] + ": " + name_matches[i] + ", ";
  }
  return retval;
}
